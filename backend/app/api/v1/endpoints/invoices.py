from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.audit_service import AuditService
from app.core.database import get_db
from app.core.security import require_permission
from app.models.sql.invoice import Invoice
from app.models.sql.project import Project
from app.models.sql.user import User
from app.schemas.invoice import (
    InvoiceCancellation,
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
)
from app.services.finance_access_service import FinanceAccessService



router = APIRouter(
    prefix="/invoices",
    tags=["finance"],
)


def generate_invoice_number() -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    suffix = uuid4().hex[:6].upper()
    return f"INV-{today}-{suffix}"


def calculate_status(record: Invoice) -> str:
    """
    Calculate the display status for an invoice.

    Persisted statuses:
    - draft
    - issued
    - partially_paid
    - paid
    - cancelled

    Overdue is derived from an issued/partially-paid invoice
    whose due date has passed.
    """
    if record.status == "cancelled":
        return "cancelled"

    if record.status == "paid":
        return "paid"

    if record.status == "draft":
        return "draft"

    amount_paid = record.amount_paid or 0
    amount = record.amount or 0

    if amount_paid > 0 and amount_paid < amount:
        if record.due_date < date.today():
            return "overdue"
        return "partially_paid"

    if record.due_date < date.today():
        return "overdue"

    return "issued"


def to_response(record: Invoice) -> InvoiceResponse:
    return InvoiceResponse(
        id=str(record.id),
        invoice_number=record.invoice_number,
        customer_name=record.customer_name,
        customer_email=record.customer_email,
        customer_phone=record.customer_phone,
        customer_address=record.customer_address,
        title=record.title,
        description=record.description,
        amount=record.amount,
        amount_paid=record.amount_paid or 0,
        currency=record.currency,
        issue_date=record.issue_date,
        due_date=record.due_date,
        status=calculate_status(record),
        project_id=str(record.project_id) if record.project_id else None,
        programme_id=str(record.programme_id)
        if record.programme_id
        else None,
        department_id=str(record.department_id)
        if record.department_id
        else None,
        notes=record.notes,
        issued_at=record.issued_at,
        paid_at=record.paid_at,
        cancelled_at=record.cancelled_at,
        cancellation_reason=record.cancellation_reason,
        created_by_id=str(record.created_by_id)
        if record.created_by_id
        else None,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


async def get_invoice_or_404(
    db: AsyncSession,
    invoice_id: UUID,
) -> Invoice:
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found.",
        )

    return record


async def ensure_invoice_access(
    db: AsyncSession,
    current_user: User,
    invoice: Invoice,
) -> None:
    """
    Finance users with organization-wide access can view all invoices.

    Other users can access invoices they created or invoices connected
    to projects they manage.
    """
    if await FinanceAccessService.can_view_all(db, current_user):
        return

    if invoice.created_by_id == current_user.person_id:
        return

    if invoice.project_id:
        project_result = await db.execute(
            select(Project).where(
                Project.id == invoice.project_id,
                Project.manager_id == current_user.person_id,
            )
        )

        if project_result.scalar_one_or_none():
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this invoice.",
    )


@router.post(
    "",
    response_model=InvoiceResponse,
)
async def create_invoice(
    body: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.create")
    ),
):
    if not current_user.person_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current user is not linked to a person record.",
        )

    if body.due_date < body.issue_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date cannot be before the issue date.",
        )

    if body.project_id:
        try:
            project_id = UUID(body.project_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid project ID.",
            )

        project_result = await db.execute(
            select(Project).where(Project.id == project_id)
        )

        if not project_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found.",
            )
    else:
        project_id = None

    record = Invoice(
        invoice_number=generate_invoice_number(),
        customer_name=body.customer_name,
        customer_email=body.customer_email,
        customer_phone=body.customer_phone,
        customer_address=body.customer_address,
        title=body.title,
        description=body.description,
        amount=body.amount,
        amount_paid=0,
        currency=body.currency.upper(),
        issue_date=body.issue_date,
        due_date=body.due_date,
        status="draft",
        project_id=project_id,
        programme_id=(
            UUID(body.programme_id)
            if body.programme_id
            else None
        ),
        department_id=(
            UUID(body.department_id)
            if body.department_id
            else None
        ),
        notes=body.notes,
        created_by_id=current_user.person_id,
    )

    db.add(record)
    await db.flush()
    await db.refresh(record)

    await AuditService.log(
        db=db,
        user_id=current_user.id,
        action="INVOICE_CREATED",
        entity_type="invoice",
        entity_id=record.id,
        details={
            "invoice_number": record.invoice_number,
            "customer_name": record.customer_name,
            "amount": str(record.amount),
            "currency": record.currency,
        },
    )

    await db.commit()

    return to_response(record)


@router.get(
    "",
    response_model=list[InvoiceResponse],
)
async def list_invoices(
    status_filter: str | None = Query(
        default=None,
        alias="status",
    ),
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    query = select(Invoice)

    if status_filter:
        normalized_status = status_filter.lower().strip()

        if normalized_status == "overdue":
            today = date.today()

            query = query.where(
                Invoice.status.in_(
                    ["issued", "partially_paid"]
                ),
                Invoice.due_date < today,
                Invoice.amount_paid < Invoice.amount,
            )
        elif normalized_status == "partially_paid":
            query = query.where(
                Invoice.status == "issued",
                Invoice.amount_paid > 0,
                Invoice.amount_paid < Invoice.amount,
            )
        else:
            query = query.where(
                Invoice.status == normalized_status
            )

    if search:
        search_term = f"%{search.strip()}%"

        query = query.where(
            or_(
                Invoice.invoice_number.ilike(search_term),
                Invoice.customer_name.ilike(search_term),
                Invoice.title.ilike(search_term),
            )
        )

    if not await FinanceAccessService.can_view_all(
        db,
        current_user,
    ):
        project_manager_subquery = select(
            Project.id
        ).where(
            Project.manager_id == current_user.person_id
        )

        query = query.where(
            or_(
                Invoice.created_by_id == current_user.person_id,
                Invoice.project_id.in_(
                    project_manager_subquery
                ),
            )
        )

    query = query.order_by(
        Invoice.created_at.desc()
    )

    result = await db.execute(query)
    records = result.scalars().all()

    return [
        to_response(record)
        for record in records
    ]


@router.get(
    "/{invoice_id}",
    response_model=InvoiceResponse,
)
async def get_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    record = await get_invoice_or_404(
        db,
        invoice_id,
    )

    await ensure_invoice_access(
        db,
        current_user,
        record,
    )

    return to_response(record)


@router.patch(
    "/{invoice_id}",
    response_model=InvoiceResponse,
)
async def update_invoice(
    invoice_id: UUID,
    body: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.edit")
    ),
):
    record = await get_invoice_or_404(
        db,
        invoice_id,
    )

    await ensure_invoice_access(
        db,
        current_user,
        record,
    )

    if record.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft invoices can be edited.",
        )

    update_data = body.model_dump(
        exclude_unset=True
    )

    if (
        "issue_date" in update_data
        and "due_date" not in update_data
    ):
        if record.due_date < update_data["issue_date"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Due date cannot be before the issue date.",
            )

    if (
        "due_date" in update_data
        and "issue_date" not in update_data
    ):
        if update_data["due_date"] < record.issue_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Due date cannot be before the issue date.",
            )

    if (
        "issue_date" in update_data
        and "due_date" in update_data
    ):
        if update_data["due_date"] < update_data["issue_date"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Due date cannot be before the issue date.",
            )

    if "amount" in update_data:
        if record.amount_paid > update_data["amount"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invoice amount cannot be lower than the amount already paid.",
            )

    if "currency" in update_data:
        update_data["currency"] = update_data[
            "currency"
        ].upper()

    if "project_id" in update_data:
        project_value = update_data["project_id"]

        if project_value:
            try:
                project_id = UUID(project_value)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid project ID.",
                )

            project_result = await db.execute(
                select(Project).where(
                    Project.id == project_id
                )
            )

            if not project_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Project not found.",
                )

            update_data["project_id"] = project_id
        else:
            update_data["project_id"] = None

    for field, value in update_data.items():
        if field in {
            "programme_id",
            "department_id",
        } and value:
            try:
                value = UUID(value)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid {field}.",
                )

        setattr(record, field, value)

    await db.flush()
    await db.refresh(record)

    await AuditService.log(
        db=db,
        user_id=current_user.id,
        action="INVOICE_UPDATED",
        entity_type="invoice",
        entity_id=record.id,
        details={
            "invoice_number": record.invoice_number,
        },
    )

    await db.commit()

    return to_response(record)


@router.post(
    "/{invoice_id}/issue",
    response_model=InvoiceResponse,
)
async def issue_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.create")
    ),
):
    record = await get_invoice_or_404(
        db,
        invoice_id,
    )

    await ensure_invoice_access(
        db,
        current_user,
        record,
    )

    if record.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft invoices can be issued.",
        )

    if record.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice amount must be greater than zero.",
        )

    if record.due_date < record.issue_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date cannot be before the issue date.",
        )

    record.status = "issued"
    record.issued_at = datetime.now(timezone.utc)

    await AuditService.log(
        db=db,
        user_id=current_user.id,
        action="INVOICE_ISSUED",
        entity_type="invoice",
        entity_id=record.id,
        details={
            "invoice_number": record.invoice_number,
            "amount": str(record.amount),
            "currency": record.currency,
            "due_date": record.due_date.isoformat(),
        },
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{invoice_id}/cancel",
    response_model=InvoiceResponse,
)
async def cancel_invoice(
    invoice_id: UUID,
    body: InvoiceCancellation,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.edit")
    ),
):
    record = await get_invoice_or_404(
        db,
        invoice_id,
    )

    await ensure_invoice_access(
        db,
        current_user,
        record,
    )

    if record.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Paid invoices cannot be cancelled.",
        )

    if record.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice is already cancelled.",
        )

    if record.amount_paid > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoices with payments cannot be cancelled.",
        )

    record.status = "cancelled"
    record.cancelled_at = datetime.now(timezone.utc)
    record.cancellation_reason = (
        body.cancellation_reason
    )

    await AuditService.log(
        db=db,
        user_id=current_user.id,
        action="INVOICE_CANCELLED",
        entity_type="invoice",
        entity_id=record.id,
        details={
            "invoice_number": record.invoice_number,
            "reason": body.cancellation_reason,
        },
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)