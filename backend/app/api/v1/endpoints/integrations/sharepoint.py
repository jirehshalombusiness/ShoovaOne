"""Browse and upload to the connected SharePoint library.

Documents stay in SharePoint; these endpoints return metadata and links
so the documents module can reference a file without copying it. Uploads
write straight into the library, so the app registration needs a write
grant on the site.

The library is accessed with one app-only identity, so every viewer would
otherwise see every file. Folder rules (see ``sharepoint_folder_rules``)
subtract the Finance/HR subtrees from anyone without the matching
permission before a response is built, and also block uploads into them.
"""

from typing import Optional

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
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.permission_catalog import CANONICAL_PERMISSIONS
from app.core.security import Permissions, require_permission
from app.models.sql.core.sharepoint_folder_rule import SharePointFolderRule
from app.models.sql.core.user import User
from app.services.integrations.sharepoint import (
    MAX_UPLOAD_BYTES,
    SharePointError,
    SharePointInvalidInput,
    SharePointNotConfigured,
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


def _graph_http_error(exc: SharePointError) -> HTTPException:
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
):
    """Report whether the connection is configured and actually works."""

    if not sharepoint_client.is_configured:
        return {
            "configured": False,
            "reachable": False,
            "missing_settings": settings.sharepoint_missing_settings,
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
        }
    except SharePointError as exc:
        return {
            "configured": True,
            "reachable": False,
            "missing_settings": [],
            "error": str(exc),
        }

    return {
        "configured": True,
        "reachable": True,
        "missing_settings": [],
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
