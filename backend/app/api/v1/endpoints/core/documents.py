from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from urllib.parse import urlparse
import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.core.database import get_db
from app.core.security import Permissions, get_current_active_user
from app.models.sql.core.document import Document
from app.models.pydantic.core.document import DocumentResponse
from app.services.core.permission_service import PermissionService


router = APIRouter()

ALLOWED_ENTITY_TYPES = {
    "person",
    "project",
    "programme",
    "task",
    "meeting",
    "organisation",
    "partner",
}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "text/plain",
    "text/csv",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
}

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024
MAX_NAME_LENGTH = 255
MAX_URL_LENGTH = 2048


def _validate_entity_reference(entity_type: str, entity_id: str) -> None:
    if entity_type not in ALLOWED_ENTITY_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported document entity type: {entity_type}",
        )

    try:
        uuid.UUID(str(entity_id))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid entity id",
        )


def _validate_file_metadata(
    *,
    name: str,
    file_url: str,
    file_size_bytes: Optional[int],
    mime_type: Optional[str],
) -> None:
    clean_name = (name or "").strip()

    if not clean_name or len(clean_name) > MAX_NAME_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Document name is required and must be "
                f"{MAX_NAME_LENGTH} characters or fewer"
            ),
        )

    if any(ord(char) < 32 for char in clean_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document name contains invalid characters",
        )

    if len(file_url or "") > MAX_URL_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document URL is too long",
        )

    parsed = urlparse(file_url or "")

    if parsed.scheme != "https" or not parsed.hostname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document URL must be an https URL",
        )

    if parsed.username or parsed.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document URL must not contain credentials",
        )

    host = parsed.hostname.lower()
    configured_hosts = {
        configured for configured in [settings.supabase_host] if configured
    }

    is_supabase_host = (
        host in configured_hosts
        or host.endswith(".supabase.co")
        or host.endswith(".supabase.in")
    )

    if not is_supabase_host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document URL must point to organisation storage",
        )

    if file_size_bytes is not None and not (
        0 < file_size_bytes <= MAX_FILE_SIZE_BYTES
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document size is invalid or exceeds the 25 MB limit",
        )

    if mime_type and mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported document type: {mime_type}",
        )


def _is_own_person_document(current_user, entity_type: str, entity_id: str) -> bool:
    """True when the caller is acting on their own employee document set."""
    return (
        entity_type == "person"
        and current_user.person_id is not None
        and str(entity_id) == str(current_user.person_id)
    )


async def _has_permission(db: AsyncSession, user, permission: str) -> bool:
    return await PermissionService.has_permission(db, user.id, permission)


@router.get("/{entity_type}/{entity_id}", response_model=List[DocumentResponse])
async def list_documents(
    entity_type: str,
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """List documents for an entity (project, person, programme, etc.)."""
    if not _is_own_person_document(current_user, entity_type, entity_id):
        allowed = False
        for permission in (
            Permissions.PROJECTS_VIEW,
            Permissions.PEOPLE_VIEW,
            Permissions.DOCUMENTS_VIEW,
            Permissions.HR_VIEW_SENSITIVE,
        ):
            if await _has_permission(db, current_user, permission):
                allowed = True
                break

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: documents.view required",
            )

    _validate_entity_reference(entity_type, entity_id)

    result = await db.execute(
        select(Document)
        .where(
            Document.related_entity_type == entity_type,
            Document.related_entity_id == entity_id,
            Document.deleted_at.is_(None),
        )
        .order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()

    return [
        DocumentResponse(
            id=str(d.id),
            name=d.name,
            file_url=d.file_url,
            file_size_bytes=d.file_size_bytes,
            mime_type=d.mime_type,
            type=d.type,
            owner_id=str(d.owner_id) if d.owner_id else None,
            related_entity_type=d.related_entity_type,
            related_entity_id=str(d.related_entity_id) if d.related_entity_id else None,
            visibility=d.visibility,
            version=d.version,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in docs
    ]


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    entity_type: str = Form(...),
    entity_id: str = Form(...),
    file_url: str = Form(...),
    name: str = Form(...),
    file_size_bytes: Optional[int] = Form(None),
    mime_type: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Register an uploaded file (upload happens on frontend via Supabase SDK)."""
    if not _is_own_person_document(current_user, entity_type, entity_id):
        if not await _has_permission(db, current_user, Permissions.DOCUMENTS_UPLOAD):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: documents.upload required",
            )

    _validate_entity_reference(entity_type, entity_id)
    _validate_file_metadata(
        name=name,
        file_url=file_url,
        file_size_bytes=file_size_bytes,
        mime_type=mime_type,
    )

    doc = Document(
        id=str(uuid.uuid4()),
        name=name,
        file_url=file_url,
        file_size_bytes=file_size_bytes,
        mime_type=mime_type,
        type="project",
        owner_id=current_user.person_id,
        related_entity_type=entity_type,
        related_entity_id=entity_id,
        visibility="internal",
        version=1,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return DocumentResponse(
        id=str(doc.id),
        name=doc.name,
        file_url=doc.file_url,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        type=doc.type,
        owner_id=str(doc.owner_id) if doc.owner_id else None,
        related_entity_type=doc.related_entity_type,
        related_entity_id=str(doc.related_entity_id) if doc.related_entity_id else None,
        visibility=doc.visibility,
        version=doc.version,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Soft delete a document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    is_owner = (
        doc.owner_id is not None
        and current_user.person_id is not None
        and str(doc.owner_id) == str(current_user.person_id)
    )
    if not is_owner:
        if not await _has_permission(db, current_user, Permissions.DOCUMENTS_UPLOAD):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: documents.upload required",
            )

    doc.deleted_at = datetime.now(timezone.utc)
    await db.commit()