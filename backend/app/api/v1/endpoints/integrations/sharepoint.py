"""Browse, upload and manage folders in the connected SharePoint library.

Documents stay in SharePoint; these endpoints return metadata and links
so the documents module can reference a file without copying it. Uploads
write straight into the library, so the app registration needs a write
grant on the site.

The library is accessed with one app-only identity, so every viewer would
otherwise see every file. Folder rules (see ``sharepoint_folder_rules``)
subtract the Finance/HR subtrees from anyone without the matching
permission before a response is built, and also block uploads into them.
"""

import json
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.permission_catalog import CANONICAL_PERMISSIONS
from app.core.security import Permissions, require_permission
from app.models.sql.core.notification import Notification
from app.models.sql.core.role import Role, user_roles
from app.models.sql.core.sharepoint_folder_rule import SharePointFolderRule
from app.models.sql.core.sharepoint_folder_request import SharePointFolderRequest
from app.models.sql.core.user import User
from app.services.core.audit_service import AuditService
from app.services.integrations.sharepoint import (
    MAX_UPLOAD_BYTES,
    SharePointError,
    SharePointInvalidInput,
    SharePointNotConfigured,
    SharePointConflict,
    _clean_folder_name,
    sharepoint_client,
)
from app.services.integrations.sharepoint_access import (
    filter_visible,
    item_is_restricted,
    restricted_locations,
)


router = APIRouter(prefix="/sharepoint", tags=["sharepoint"])


class FolderRuleIn(BaseModel):
    folder_id: str = Field(min_length=1, max_length=400)
    required_permission: str = Field(min_length=3, max_length=100)


class FolderCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_folder_id: Optional[str] = Field(None, max_length=400)


class FolderRequestIn(BaseModel):
    action: Literal["create", "delete"]
    folder_name: Optional[str] = Field(None, max_length=255)
    folder_id: Optional[str] = Field(None, max_length=400)
    parent_folder_id: Optional[str] = Field(None, max_length=400)
    reason: str = Field(min_length=5, max_length=1000)


class FolderRequestDecisionIn(BaseModel):
    decision: Literal["approved", "rejected"]
    note: Optional[str] = Field(None, max_length=1000)


def _request_payload(folder_request: SharePointFolderRequest) -> dict:
    return {
        "id": folder_request.id,
        "action": folder_request.action,
        "folder_name": folder_request.folder_name,
        "folder_id": folder_request.folder_id,
        "parent_folder_id": folder_request.parent_folder_id,
        "folder_path": folder_request.folder_path,
        "reason": folder_request.reason,
        "status": folder_request.status,
        "decision_note": folder_request.decision_note,
        "requested_by_id": folder_request.requested_by_id,
        "resolved_by_id": folder_request.resolved_by_id,
        "resolved_at": folder_request.resolved_at,
        "created_at": folder_request.created_at,
    }


async def _is_ceo(db: AsyncSession, user_id: str) -> bool:
    result = await db.execute(
        select(Role.id)
        .join(user_roles, user_roles.c.role_id == Role.id)
        .where(user_roles.c.user_id == user_id, Role.name == "ceo")
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _require_ceo(db: AsyncSession, user: User) -> None:
    if not await _is_ceo(db, user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a CEO can create or delete SharePoint folders",
        )


async def _ceo_user_ids(db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(User.id)
        .join(user_roles, user_roles.c.user_id == User.id)
        .join(Role, Role.id == user_roles.c.role_id)
        .where(User.is_active.is_(True), Role.name == "ceo")
    )
    return list(dict.fromkeys(result.scalars().all()))


async def _notify_ceos(
    db: AsyncSession,
    *,
    title: str,
    body: str,
    extra_data: dict,
) -> None:
    ceo_ids = await _ceo_user_ids(db)
    if not ceo_ids:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No active CEO account is configured to receive folder requests",
        )
    db.add_all(
        [
            Notification(
                user_id=ceo_id,
                title=title,
                body=body,
                type="info",
                link="/documents?folder-requests=1",
                extra_data=json.dumps(extra_data),
            )
            for ceo_id in ceo_ids
        ]
    )


async def _get_accessible_folder(
    db: AsyncSession,
    user: User,
    folder_id: Optional[str],
) -> tuple[Optional[dict], str]:
    if not folder_id:
        return None, "/"

    try:
        folder = await sharepoint_client.get_item(folder_id)
    except SharePointError as exc:
        raise _graph_http_error(exc)

    if not folder.get("is_folder"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected item is not a folder",
        )
    denied_paths, denied_ids = await restricted_locations(db, user.id)
    if item_is_restricted(folder, denied_paths, denied_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found",
        )
    return folder, folder.get("path") or ""


async def _require_empty_folder(folder: dict) -> None:
    path = folder.get("path") or ""
    if not path or path == "/":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The library root cannot be deleted",
        )
    try:
        children = await sharepoint_client.list_children(folder["id"])
    except SharePointError as exc:
        raise _graph_http_error(exc)
    if children:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only empty folders can be deleted",
        )


def _graph_http_error(exc: SharePointError) -> HTTPException:
    if isinstance(exc, SharePointConflict):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    if isinstance(exc, SharePointInvalidInput):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    if isinstance(exc, SharePointNotConfigured):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )

    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=str(exc),
    )


def _upload_file_name(raw: Optional[str]) -> str:
    """Drop any directory part a client may have included."""

    name = (raw or "").replace("\\", "/").split("/")[-1].strip()

    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A file name is required",
        )

    return name


async def _read_upload(file: UploadFile) -> bytes:
    """Read the upload in chunks so an oversized file is refused early."""

    chunks: list[bytes] = []
    total = 0

    while True:
        chunk = await file.read(1024 * 1024)

        if not chunk:
            break

        total += len(chunk)

        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    "Files must be "
                    f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MB or smaller"
                ),
            )

        chunks.append(chunk)

    return b"".join(chunks)


def _rule_payload(rule: SharePointFolderRule) -> dict:
    return {
        "id": rule.id,
        "folder_id": rule.folder_id,
        "folder_path": rule.folder_path,
        "folder_name": rule.folder_name,
        "required_permission": rule.required_permission,
        "created_at": rule.created_at,
        "updated_at": rule.updated_at,
    }


@router.get("/status")
async def sharepoint_status(
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_VIEW)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Report whether the connection is configured and actually works."""

    if not sharepoint_client.is_configured:
        return {
            "configured": False,
            "reachable": False,
            "missing_settings": settings.sharepoint_missing_settings,
            "can_manage_folders": await _is_ceo(db, current_user.id),
        }

    try:
        site = await sharepoint_client.site()
        drive = await sharepoint_client.drive()
    except SharePointNotConfigured as exc:
        return {
            "configured": False,
            "reachable": False,
            "missing_settings": settings.sharepoint_missing_settings,
            "error": str(exc),
            "can_manage_folders": await _is_ceo(db, current_user.id),
        }
    except SharePointError as exc:
        return {
            "configured": True,
            "reachable": False,
            "missing_settings": [],
            "error": str(exc),
            "can_manage_folders": await _is_ceo(db, current_user.id),
        }

    return {
        "configured": True,
        "reachable": True,
        "missing_settings": [],
        "can_manage_folders": await _is_ceo(db, current_user.id),
        "site": {
            "id": site.get("id"),
            "name": site.get("displayName") or site.get("name"),
            "web_url": site.get("webUrl"),
        },
        "drive": {
            "id": drive.get("id"),
            "name": drive.get("name"),
            "web_url": drive.get("webUrl"),
        },
    }


@router.get("/items")
async def list_sharepoint_items(
    folder_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None, min_length=2, max_length=200),
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_VIEW)
    ),
    db: AsyncSession = Depends(get_db),
):
    """List a folder, or search the connected library."""

    denied_paths, denied_ids = await restricted_locations(
        db,
        current_user.id,
    )

    try:
        if q:
            items = await sharepoint_client.search(
                q,
                resolve_paths=bool(denied_paths or denied_ids),
            )
        else:
            if folder_id and (denied_paths or denied_ids):
                folder = await sharepoint_client.get_item(folder_id)

                if item_is_restricted(folder, denied_paths, denied_ids):
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Folder not found",
                    )

            items = await sharepoint_client.list_children(folder_id)
    except SharePointError as exc:
        raise _graph_http_error(exc)

    return {
        "folder_id": folder_id or "root",
        "query": q,
        "items": filter_visible(items, denied_paths, denied_ids),
    }


@router.get("/items/{item_id}")
async def get_sharepoint_item(
    item_id: str,
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_VIEW)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Fetch one file or folder's metadata and web link."""

    denied_paths, denied_ids = await restricted_locations(
        db,
        current_user.id,
    )

    try:
        item = await sharepoint_client.get_item(item_id)
    except SharePointError as exc:
        raise _graph_http_error(exc)

    if item_is_restricted(item, denied_paths, denied_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    return item


@router.post("/items/upload", status_code=status.HTTP_201_CREATED)
async def upload_sharepoint_item(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_UPLOAD)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Upload one file into a folder, or into the library root."""

    denied_paths, denied_ids = await restricted_locations(
        db,
        current_user.id,
    )
    folder_path = ""

    try:
        if folder_id:
            folder = await sharepoint_client.get_item(folder_id)

            if not folder.get("is_folder"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Files can only be uploaded into a folder",
                )

            if item_is_restricted(folder, denied_paths, denied_ids):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have access to this folder",
                )

            folder_path = folder.get("path") or ""

        content = await _read_upload(file)

        item = await sharepoint_client.upload_file(
            filename=_upload_file_name(file.filename),
            content=content,
            content_type=file.content_type,
            folder_id=folder_id,
        )
    except SharePointError as exc:
        raise _graph_http_error(exc)

    if not item.get("path") and folder_path:
        item["path"] = f"{folder_path.rstrip('/')}/{item.get('name')}"

    return item


@router.post("/items/folders", status_code=status.HTTP_201_CREATED)
async def create_sharepoint_folder(
    payload: FolderCreateIn,
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_VIEW)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Create a folder directly; only an account with the CEO role may do so."""
    await _require_ceo(db, current_user)
    parent, parent_path = await _get_accessible_folder(
        db, current_user, payload.parent_folder_id
    )
    try:
        folder = await sharepoint_client.create_folder(
            name=payload.name,
            parent_id=parent.get("id") if parent else None,
        )
    except SharePointError as exc:
        raise _graph_http_error(exc)

    if not folder.get("path"):
        folder["path"] = f"{parent_path.rstrip('/')}/{folder['name']}"
    await AuditService.log(
        db,
        actor=current_user,
        action="sharepoint.folder.create",
        entity_type="SharePointFolder",
        entity_id=folder.get("id"),
        new_values={"name": folder.get("name"), "path": folder.get("path")},
    )
    await db.commit()
    return folder


@router.delete("/items/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sharepoint_folder(
    folder_id: str,
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_VIEW)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Delete an empty SharePoint folder; only the CEO role can do so."""
    await _require_ceo(db, current_user)
    folder, _ = await _get_accessible_folder(db, current_user, folder_id)
    await _require_empty_folder(folder)
    try:
        await sharepoint_client.delete_folder(folder_id)
    except SharePointError as exc:
        raise _graph_http_error(exc)

    await AuditService.log(
        db,
        actor=current_user,
        action="sharepoint.folder.delete",
        entity_type="SharePointFolder",
        entity_id=folder_id,
        old_values={"name": folder.get("name"), "path": folder.get("path")},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/folder-requests", status_code=status.HTTP_201_CREATED)
async def create_folder_request(
    payload: FolderRequestIn,
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_VIEW)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Submit a folder create/delete request for CEO review."""
    if len(payload.reason.strip()) < 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Reason must contain at least 5 non-whitespace characters",
        )

    if payload.action == "create":
        if not payload.folder_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A folder name is required",
            )
        try:
            folder_name = _clean_folder_name(payload.folder_name)
        except SharePointInvalidInput as exc:
            raise _graph_http_error(exc)
        parent, parent_path = await _get_accessible_folder(
            db, current_user, payload.parent_folder_id
        )
        folder_id = None
        parent_folder_id = parent.get("id") if parent else None
        folder_path = f"{parent_path.rstrip('/')}/{folder_name}"
    else:
        if not payload.folder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A folder must be selected for a deletion request",
            )
        folder, folder_path = await _get_accessible_folder(
            db, current_user, payload.folder_id
        )
        await _require_empty_folder(folder)
        folder_name = folder.get("name") or ""
        folder_id = folder.get("id")
        parent_folder_id = None

    existing = (
        await db.execute(
            select(SharePointFolderRequest.id).where(
                SharePointFolderRequest.status == "pending",
                SharePointFolderRequest.action == payload.action,
                SharePointFolderRequest.folder_path == folder_path,
                SharePointFolderRequest.requested_by_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending request for this folder",
        )

    folder_request = SharePointFolderRequest(
        action=payload.action,
        folder_name=folder_name,
        folder_id=folder_id,
        parent_folder_id=parent_folder_id,
        folder_path=folder_path,
        reason=payload.reason.strip(),
        status="pending",
        requested_by_id=current_user.id,
    )
    db.add(folder_request)
    await db.flush()
    await AuditService.log(
        db,
        actor=current_user,
        action="sharepoint.folder_request.create",
        entity_type="SharePointFolderRequest",
        entity_id=folder_request.id,
        new_values={
            "action": folder_request.action,
            "folder_path": folder_request.folder_path,
            "reason": folder_request.reason,
        },
    )
    await _notify_ceos(
        db,
        title="SharePoint folder request",
        body=(
            f"{'Create' if payload.action == 'create' else 'Delete'} "
            f"request for {folder_path}"
        ),
        extra_data={"folder_request_id": folder_request.id},
    )
    await db.commit()
    await db.refresh(folder_request)
    return _request_payload(folder_request)


@router.get("/folder-requests/mine")
async def list_my_folder_requests(
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_VIEW)
    ),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SharePointFolderRequest)
        .where(SharePointFolderRequest.requested_by_id == current_user.id)
        .order_by(SharePointFolderRequest.created_at.desc())
        .limit(100)
    )
    return {"requests": [_request_payload(item) for item in result.scalars().all()]}


@router.get("/folder-requests")
async def list_folder_requests(
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_VIEW)
    ),
    db: AsyncSession = Depends(get_db),
):
    await _require_ceo(db, current_user)
    result = await db.execute(
        select(SharePointFolderRequest)
        .order_by(
            case(
                (SharePointFolderRequest.status == "pending", 0),
                else_=1,
            ),
            SharePointFolderRequest.created_at.desc(),
        )
        .limit(100)
    )
    return {"requests": [_request_payload(item) for item in result.scalars().all()]}


@router.post("/folder-requests/{request_id}/decision")
async def decide_folder_request(
    request_id: str,
    payload: FolderRequestDecisionIn,
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_VIEW)
    ),
    db: AsyncSession = Depends(get_db),
):
    await _require_ceo(db, current_user)
    folder_request = (
        await db.execute(
            select(SharePointFolderRequest)
            .where(SharePointFolderRequest.id == request_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if folder_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder request not found",
        )
    if folder_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This folder request has already been resolved",
        )

    if payload.decision == "approved":
        if folder_request.action == "create":
            parent, parent_path = await _get_accessible_folder(
                db, current_user, folder_request.parent_folder_id
            )
            try:
                folder = await sharepoint_client.create_folder(
                    name=folder_request.folder_name,
                    parent_id=parent.get("id") if parent else None,
                )
            except SharePointError as exc:
                raise _graph_http_error(exc)
            if not folder.get("path"):
                folder["path"] = (
                    f"{parent_path.rstrip('/')}/{folder['name']}"
                )
            await AuditService.log(
                db,
                actor=current_user,
                action="sharepoint.folder.create",
                entity_type="SharePointFolder",
                entity_id=folder.get("id"),
                new_values={
                    "name": folder.get("name"),
                    "path": folder.get("path"),
                    "request_id": folder_request.id,
                },
            )
        else:
            folder, _ = await _get_accessible_folder(
                db, current_user, folder_request.folder_id
            )
            await _require_empty_folder(folder)
            try:
                await sharepoint_client.delete_folder(folder_request.folder_id)
            except SharePointError as exc:
                raise _graph_http_error(exc)
            await AuditService.log(
                db,
                actor=current_user,
                action="sharepoint.folder.delete",
                entity_type="SharePointFolder",
                entity_id=folder_request.folder_id,
                old_values={
                    "name": folder.get("name"),
                    "path": folder.get("path"),
                    "request_id": folder_request.id,
                },
            )

    folder_request.status = payload.decision
    folder_request.decision_note = (payload.note or "").strip() or None
    folder_request.resolved_by_id = current_user.id
    folder_request.resolved_at = datetime.now(timezone.utc)
    await AuditService.log(
        db,
        actor=current_user,
        action=f"sharepoint.folder_request.{payload.decision}",
        entity_type="SharePointFolderRequest",
        entity_id=folder_request.id,
        new_values={
            "status": folder_request.status,
            "decision_note": folder_request.decision_note,
        },
    )
    db.add(
        Notification(
            user_id=folder_request.requested_by_id,
            title=f"Folder request {payload.decision}",
            body=(
                f"Your request for {folder_request.folder_path} was "
                f"{payload.decision}."
            ),
            type="info" if payload.decision == "approved" else "warning",
            link="/documents",
            extra_data=json.dumps({"folder_request_id": folder_request.id}),
        )
    )
    await db.commit()
    await db.refresh(folder_request)
    return _request_payload(folder_request)


@router.get("/rules")
async def list_folder_rules(
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_MANAGE)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Every folder restriction, for the access-management panel."""

    result = await db.execute(
        select(SharePointFolderRule).order_by(
            SharePointFolderRule.folder_path
        )
    )

    return {
        "rules": [
            _rule_payload(rule)
            for rule in result.scalars().all()
        ]
    }


@router.post("/rules", status_code=status.HTTP_201_CREATED)
async def upsert_folder_rule(
    payload: FolderRuleIn,
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_MANAGE)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Restrict a folder (and everything below it) to a permission."""

    if payload.required_permission not in CANONICAL_PERMISSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown permission: {payload.required_permission}",
        )

    try:
        folder = await sharepoint_client.get_item(payload.folder_id)
    except SharePointError as exc:
        raise _graph_http_error(exc)

    if not folder.get("is_folder"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only folders can be restricted",
        )

    path = folder.get("path") or ""

    if not path or path == "/":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not resolve the folder path",
        )

    result = await db.execute(
        select(SharePointFolderRule).where(
            func.lower(SharePointFolderRule.folder_path) == path.lower()
        )
    )
    rule = result.scalar_one_or_none()

    if rule is None:
        rule = SharePointFolderRule(folder_path=path)
        db.add(rule)

    rule.folder_id = folder.get("id")
    rule.folder_name = folder.get("name")
    rule.required_permission = payload.required_permission
    rule.created_by_id = current_user.id

    await db.commit()
    await db.refresh(rule)

    return _rule_payload(rule)


@router.delete(
    "/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_folder_rule(
    rule_id: str,
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_MANAGE)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Remove a restriction so the folder is visible to all viewers."""

    rule = await db.get(SharePointFolderRule, rule_id)

    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found",
        )

    await db.delete(rule)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
