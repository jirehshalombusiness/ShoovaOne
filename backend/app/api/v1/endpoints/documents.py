from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.models.sql.document import Document
from app.models.pydantic.document import DocumentResponse


router = APIRouter()


@router.get("/{entity_type}/{entity_id}", response_model=List[DocumentResponse])
async def list_documents(
    entity_type: str,
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PROJECTS_VIEW)),
):
    """List documents for an entity (project, person, programme, etc.)."""
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
    current_user = Depends(require_permission(Permissions.DOCUMENTS_UPLOAD)),
):
    """Register an uploaded file (upload happens on frontend via Supabase SDK)."""
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
    current_user = Depends(require_permission(Permissions.DOCUMENTS_UPLOAD)),
):
    """Soft delete a document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.deleted_at = datetime.now(timezone.utc)
    await db.commit()