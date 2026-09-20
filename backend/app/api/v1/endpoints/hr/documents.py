from datetime import date, datetime, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.models.sql.user import User, Person
from app.models.sql.document import Document
from app.models.sql.document_type import DocumentType
from app.services.audit_service import AuditService


router = APIRouter()


# ============================================================
# SCHEMAS — DOCUMENTS
# ============================================================

class DocumentPersonInfo(BaseModel):
    id: str
    first_name: str
    last_name: str
    profile_image_url: Optional[str] = None
    department: Optional[str] = None


class DocumentItem(BaseModel):
    id: str
    name: str
    file_url: str
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    type: Optional[str] = None
    visibility: str
    version: int
    document_type_id: Optional[str] = None
    document_type_name: Optional[str] = None
    expiry_date: Optional[str] = None
    verified: bool
    verified_by_id: Optional[str] = None
    verified_by_name: Optional[str] = None
    verified_at: Optional[str] = None
    owner_id: Optional[str] = None
    owner: Optional[DocumentPersonInfo] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None


class DocumentListResponse(BaseModel):
    items: List[DocumentItem]
    total: int
    unverified: int
    expiring_30: int
    expired: int


class VerifyRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=1000)


# ============================================================
# SCHEMAS — DOCUMENT TYPES
# ============================================================

class DocumentTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    is_required: bool = True
    applies_to: str = Field("all", max_length=50)
    validity_months: Optional[int] = Field(None, ge=1, le=600)


class DocumentTypeCreate(DocumentTypeBase):
    pass


class DocumentTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_required: Optional[bool] = None
    applies_to: Optional[str] = Field(None, max_length=50)
    validity_months: Optional[int] = Field(None, ge=1, le=600)


class DocumentTypeResponse(DocumentTypeBase):
    id: str
    documents_count: int = 0


# ============================================================
# HELPERS
# ============================================================

def _iso(d) -> Optional[str]:
    if d is None:
        return None
    return d.isoformat()


async def _person_bundle(db: AsyncSession, ids: List[str]) -> dict[str, Person]:
    if not ids:
        return {}
    result = await db.execute(select(Person).where(Person.id.in_(ids)))
    return {p.id: p for p in result.scalars().all()}


# ============================================================
# DOCUMENTS — LIST
# ============================================================

@router.get("", response_model=DocumentListResponse)
async def list_documents(
    person_id: Optional[str] = None,
    document_type_id: Optional[str] = None,
    verified: Optional[bool] = None,
    expiring_in_days: Optional[int] = Query(None, ge=1, le=365),
    expired_only: bool = Query(False),
    search: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """
    All HR documents across the org.

    Requires hr.view_sensitive.
    """
    today = date.today()
    filters = [
        Document.deleted_at.is_(None),
        Document.related_entity_type == "person",
    ]

    if person_id:
        filters.append(Document.related_entity_id == person_id)

    if document_type_id:
        filters.append(Document.document_type_id == document_type_id)

    if verified is not None:
        filters.append(Document.verified.is_(verified))

    if expiring_in_days is not None:
        horizon = today + __import__("datetime").timedelta(days=expiring_in_days)
        filters.append(Document.expiry_date.is_not(None))
        filters.append(Document.expiry_date >= today)
        filters.append(Document.expiry_date <= horizon)

    if expired_only:
        filters.append(Document.expiry_date.is_not(None))
        filters.append(Document.expiry_date < today)

    if search:
        pattern = f"%{search}%"
        filters.append(
            or_(
                Document.name.ilike(pattern),
                Document.related_entity_id.in_(
                    select(Person.id).where(
                        or_(
                            Person.first_name.ilike(pattern),
                            Person.last_name.ilike(pattern),
                        )
                    )
                ),
            )
        )

    count_query = select(func.count(Document.id)).where(*filters)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    unverified_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.deleted_at.is_(None),
            Document.related_entity_type == "person",
            or_(
                Document.verified.is_(False),
                Document.verified.is_(None),
            ),
        )
    )
    unverified = unverified_result.scalar() or 0

    from datetime import timedelta
    h30 = today + timedelta(days=30)

    expiring_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.deleted_at.is_(None),
            Document.expiry_date.is_not(None),
            Document.expiry_date >= today,
            Document.expiry_date <= h30,
        )
    )
    expiring_30 = expiring_result.scalar() or 0

    expired_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.deleted_at.is_(None),
            Document.expiry_date.is_not(None),
            Document.expiry_date < today,
        )
    )
    expired = expired_result.scalar() or 0

    result = await db.execute(
        select(Document)
        .where(*filters)
        .order_by(Document.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    documents = list(result.scalars().all())

    owner_ids = [d.related_entity_id for d in documents if d.related_entity_id]
    owners = await _person_bundle(db, owner_ids)

    verifier_ids = [d.verified_by for d in documents if d.verified_by]
    verifiers = await _person_bundle(db, verifier_ids)

    type_ids = [d.document_type_id for d in documents if d.document_type_id]
    type_map: dict[str, DocumentType] = {}
    if type_ids:
        t_result = await db.execute(
            select(DocumentType).where(DocumentType.id.in_(type_ids))
        )
        type_map = {t.id: t for t in t_result.scalars().all()}

    def _ser(d: Document) -> DocumentItem:
        owner = owners.get(d.related_entity_id) if d.related_entity_id else None
        verifier = verifiers.get(d.verified_by) if d.verified_by else None
        dt = type_map.get(d.document_type_id) if d.document_type_id else None

        return DocumentItem(
            id=d.id,
            name=d.name,
            file_url=d.file_url,
            file_size_bytes=d.file_size_bytes,
            mime_type=d.mime_type,
            type=d.type,
            visibility=d.visibility,
            version=d.version,
            document_type_id=d.document_type_id,
            document_type_name=dt.name if dt else None,
            expiry_date=_iso(d.expiry_date),
            verified=bool(d.verified),
            verified_by_id=d.verified_by,
            verified_by_name=(
                f"{verifier.first_name} {verifier.last_name}".strip()
                if verifier
                else None
            ),
            verified_at=_iso(d.verified_at),
            owner_id=d.related_entity_id,
            owner=(
                DocumentPersonInfo(
                    id=owner.id,
                    first_name=owner.first_name,
                    last_name=owner.last_name,
                    profile_image_url=owner.profile_image_url,
                    department=owner.department,
                )
                if owner
                else None
            ),
            related_entity_type=d.related_entity_type,
            related_entity_id=d.related_entity_id,
            created_at=d.created_at.isoformat() if d.created_at else "",
            updated_at=_iso(d.updated_at),
        )

    return DocumentListResponse(
        items=[_ser(d) for d in documents],
        total=total,
        unverified=unverified,
        expiring_30=expiring_30,
        expired=expired,
    )


# ============================================================
# DOCUMENTS — GET ONE
# ============================================================

@router.get("/{document_id}", response_model=DocumentItem)
async def get_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.deleted_at.is_(None),
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    owners = await _person_bundle(
        db, [document.related_entity_id] if document.related_entity_id else []
    )
    verifiers = await _person_bundle(
        db, [document.verified_by] if document.verified_by else []
    )

    dt = None
    if document.document_type_id:
        t_result = await db.execute(
            select(DocumentType).where(DocumentType.id == document.document_type_id)
        )
        dt = t_result.scalar_one_or_none()

    owner = owners.get(document.related_entity_id) if document.related_entity_id else None
    verifier = verifiers.get(document.verified_by) if document.verified_by else None

    return DocumentItem(
        id=document.id,
        name=document.name,
        file_url=document.file_url,
        file_size_bytes=document.file_size_bytes,
        mime_type=document.mime_type,
        type=document.type,
        visibility=document.visibility,
        version=document.version,
        document_type_id=document.document_type_id,
        document_type_name=dt.name if dt else None,
        expiry_date=_iso(document.expiry_date),
        verified=bool(document.verified),
        verified_by_id=document.verified_by,
        verified_by_name=(
            f"{verifier.first_name} {verifier.last_name}".strip()
            if verifier
            else None
        ),
        verified_at=_iso(document.verified_at),
        owner_id=document.related_entity_id,
        owner=(
            DocumentPersonInfo(
                id=owner.id,
                first_name=owner.first_name,
                last_name=owner.last_name,
                profile_image_url=owner.profile_image_url,
                department=owner.department,
            )
            if owner
            else None
        ),
        related_entity_type=document.related_entity_type,
        related_entity_id=document.related_entity_id,
        created_at=document.created_at.isoformat() if document.created_at else "",
        updated_at=_iso(document.updated_at),
    )


# ============================================================
# DOCUMENTS — VERIFY / REJECT
# ============================================================

@router.post("/{document_id}/verify", response_model=DocumentItem)
async def verify_document(
    document_id: str,
    payload: VerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_SENSITIVE)),
):
    """
    Mark a document as verified.
    """
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.deleted_at.is_(None),
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    old_verified = document.verified
    document.verified = True
    document.verified_by = current_user.person_id
    document.verified_at = datetime.now(timezone.utc)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="DOCUMENT_VERIFIED",
        entity_type="document",
        entity_id=document.id,
        description=f"Verified document '{document.name}'",
        old_values={"verified": old_verified},
        new_values={
            "verified": True,
            "verified_by": current_user.person_id,
            "note": payload.note,
        },
    )

    await db.commit()

    return await get_document(document_id, db=db, current_user=current_user)


@router.post("/{document_id}/unverify", response_model=DocumentItem)
async def unverify_document(
    document_id: str,
    payload: VerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_SENSITIVE)),
):
    """Reverse a verification, e.g. after discovering the file is wrong."""
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.deleted_at.is_(None),
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    document.verified = False
    document.verified_by = None
    document.verified_at = None

    await AuditService.log(
        db=db,
        actor=current_user,
        action="DOCUMENT_UNVERIFIED",
        entity_type="document",
        entity_id=document.id,
        description=f"Unverified document '{document.name}'",
        old_values={"verified": True},
        new_values={"verified": False, "note": payload.note},
    )

    await db.commit()

    return await get_document(document_id, db=db, current_user=current_user)


# ============================================================
# DOCUMENTS — DELETE (soft)
# ============================================================

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_SENSITIVE)),
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.deleted_at.is_(None),
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    document.deleted_at = datetime.now(timezone.utc)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="DOCUMENT_DELETED",
        entity_type="document",
        entity_id=document.id,
        description=f"Soft-deleted document '{document.name}'",
    )

    await db.commit()
    return None


# ============================================================
# DOCUMENT TYPES
# ============================================================

@router.get("/types/all", response_model=List[DocumentTypeResponse])
async def list_document_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """All document types."""
    result = await db.execute(select(DocumentType).order_by(DocumentType.name))
    types = list(result.scalars().all())

    counts_result = await db.execute(
        select(Document.document_type_id, func.count(Document.id))
        .where(Document.deleted_at.is_(None))
        .group_by(Document.document_type_id)
    )
    counts = {row[0]: row[1] for row in counts_result.all()}

    return [
        DocumentTypeResponse(
            id=t.id,
            name=t.name,
            description=t.description,
            is_required=bool(t.is_required),
            applies_to=t.applies_to or "all",
            validity_months=t.validity_months,
            documents_count=counts.get(t.id, 0),
        )
        for t in types
    ]


@router.post(
    "/types/all",
    response_model=DocumentTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_document_type(
    payload: DocumentTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_SENSITIVE)),
):
    existing = await db.execute(
        select(DocumentType).where(DocumentType.name == payload.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A document type with that name exists")

    dt = DocumentType(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(dt)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="DOCUMENT_TYPE_CREATED",
        entity_type="document_type",
        entity_id=dt.id,
        description=f"Created document type '{payload.name}'",
        new_values=payload.model_dump(),
    )

    await db.commit()
    await db.refresh(dt)

    return DocumentTypeResponse(
        id=dt.id,
        name=dt.name,
        description=dt.description,
        is_required=bool(dt.is_required),
        applies_to=dt.applies_to or "all",
        validity_months=dt.validity_months,
        documents_count=0,
    )


@router.patch("/types/all/{type_id}", response_model=DocumentTypeResponse)
async def update_document_type(
    type_id: str,
    payload: DocumentTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_SENSITIVE)),
):
    result = await db.execute(select(DocumentType).where(DocumentType.id == type_id))
    dt = result.scalar_one_or_none()
    if not dt:
        raise HTTPException(status_code=404, detail="Document type not found")

    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(dt, k, v)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="DOCUMENT_TYPE_UPDATED",
        entity_type="document_type",
        entity_id=dt.id,
        description=f"Updated document type '{dt.name}'",
        new_values=changes,
    )

    await db.commit()
    await db.refresh(dt)

    counts_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.document_type_id == dt.id,
            Document.deleted_at.is_(None),
        )
    )
    count = counts_result.scalar() or 0

    return DocumentTypeResponse(
        id=dt.id,
        name=dt.name,
        description=dt.description,
        is_required=bool(dt.is_required),
        applies_to=dt.applies_to or "all",
        validity_months=dt.validity_months,
        documents_count=count,
    )


@router.delete("/types/all/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_type(
    type_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_SENSITIVE)),
):
    result = await db.execute(select(DocumentType).where(DocumentType.id == type_id))
    dt = result.scalar_one_or_none()
    if not dt:
        raise HTTPException(status_code=404, detail="Document type not found")

    count_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.document_type_id == dt.id,
            Document.deleted_at.is_(None),
        )
    )
    if (count_result.scalar() or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a document type still in use",
        )

    name = dt.name
    await db.delete(dt)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="DOCUMENT_TYPE_DELETED",
        entity_type="document_type",
        entity_id=type_id,
        description=f"Deleted document type '{name}'",
    )

    await db.commit()
    return None