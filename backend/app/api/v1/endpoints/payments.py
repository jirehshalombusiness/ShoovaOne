from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission
from app.models.sql.invoice import Invoice
from app.models.sql.payment import Payment
from app.models.sql.user import User
from app.schemas.payment import (
    PaymentCancellation,
    PaymentCreate,
    PaymentResponse,
    PaymentUpdate,
)
from app.services.audit_service import AuditService
from app.services.finance_access_service import FinanceAccessService


router = APIRouter()


def generate_payment_number() -> str:
    """Generate a unique payment number."""
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = uuid4().hex[:6].upper()
    return f"PAY-{date_part}-{random_part}"


def to_response(payment: Payment) -> PaymentResponse:
    return PaymentResponse(
        id=str(payment.id),
        payment_number=payment.payment_number,
        invoice_id=str(payment.invoice_id),
        amount=payment.amount,
        currency=payment.currency,
        payment_date=payment.payment_date,
        payment_method=payment.payment_method,
        reference=payment.reference,
        payer_name=payment.payer_name,
        payer_email=payment.payer_email,
        notes=payment.notes,
        status=payment.status,
        recorded_by_id=(
            str(payment.recorded_by_id)
            if payment.recorded_by_id
            else None
        ),
        recorded_at=payment.recorded_at,
        created_at=payment.created_at,
        updated_at=payment.updated_at,
    )


async def get_payment_or_404(
    db: AsyncSession,
    payment_id: str,
) -> Payment:
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id)
    )

    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    return payment


async def get_invoice_or_404(
    db: AsyncSession,
    invoice_id: str,
) -> Invoice:
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )

    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    return invoice


async def ensure_invoice_access(
    db: AsyncSession,
    invoice: Invoice,
    current_user: User,
) -> None:
    """
    Restrict invoice/payment access using the same finance access model.

    Organisation-wide finance roles can access all invoices.
    Other users can access invoices they created or invoices connected
    to projects they manage.
    """
    if await FinanceAccessService.can_view_all(db, current_user):
        return

    if (
        invoice.created_by_id
        and current_user.person_id
        and invoice.created_by_id == current_user.person_id
    ):
        return

    if invoice.project_id:
        from app.models.sql.project import Project

        project_result = await db.execute(
            select(Project).where(Project.id == invoice.project_id)
        )
        project = project_result.scalar_one_or_none()

        if (
            project
            and project.manager_id
            and current_user.person_id
            and project.manager_id == current_user.person_id
        ):
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this invoice",
    )


async def calculate_invoice_paid_amount(
    db: AsyncSession,
    invoice_id: str,
) -> Decimal:
    result = await db.execute(
        select(Payment).where(
            Payment.invoice_id == invoice_id,
            Payment.status == "completed",
        )
    )

    payments = result.scalars().all()

    return sum(
        (Decimal(str(payment.amount)) for payment in payments),
        Decimal("0"),
    )


async def refresh_invoice_payment_status(
    db: AsyncSession,
    invoice: Invoice,
) -> None:
    """
    Recalculate invoice payment totals and status from completed payments.
    """
    amount_paid = await calculate_invoice_paid_amount(
        db,
        invoice.id,
    )

    invoice.amount_paid = amount_paid

    invoice_amount = Decimal(str(invoice.amount))

    if amount_paid >= invoice_amount:
        invoice.amount_paid = invoice_amount
        invoice.status = "paid"

        if not invoice.paid_at:
            invoice.paid_at = datetime.now(timezone.utc)

    elif amount_paid > Decimal("0"):
        invoice.status = "partially_paid"
        invoice.paid_at = None

    else:
        invoice.status = "issued"
        invoice.paid_at = None


@router.post(
    "/payments",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment(
    payload: PaymentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.create")
    ),
):
    invoice = await get_invoice_or_404(
        db,
        payload.invoice_id,
    )

    await ensure_invoice_access(
        db,
        invoice,
        current_user,
    )

    if invoice.status == "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payments cannot be recorded against a draft invoice",
        )

    if invoice.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payments cannot be recorded against a cancelled invoice",
        )

    if payload.currency.upper() != invoice.currency.upper():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Payment currency must match invoice currency "
                f"({invoice.currency})"
            ),
        )

    await refresh_invoice_payment_status(
        db,
        invoice,
    )

    invoice_amount = Decimal(str(invoice.amount))
    current_paid = Decimal(str(invoice.amount_paid or 0))
    remaining = invoice_amount - current_paid

    if payload.amount > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Payment amount exceeds the outstanding invoice balance. "
                f"Outstanding balance: {invoice.currency} {remaining:.2f}"
            ),
        )

    payment = Payment(
        payment_number=generate_payment_number(),
        invoice_id=invoice.id,
        amount=payload.amount,
        currency=payload.currency.upper(),
        payment_date=payload.payment_date,
        payment_method=payload.payment_method,
        reference=payload.reference,
        payer_name=payload.payer_name,
        payer_email=payload.payer_email,
        notes=payload.notes,
        status="completed",
        recorded_by_id=current_user.person_id,
        recorded_at=datetime.now(timezone.utc),
    )

    db.add(payment)

    await db.flush()

    await refresh_invoice_payment_status(
        db,
        invoice,
    )

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAYMENT_RECORDED",
        entity_type="Payment",
        entity_id=str(payment.id),
        description=(
            f"Payment {payment.payment_number} recorded for "
            f"invoice {invoice.invoice_number}"
        ),
        new_values={
            "payment_number": payment.payment_number,
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "amount": str(payment.amount),
            "currency": payment.currency,
            "payment_method": payment.payment_method,
            "reference": payment.reference,
            "status": payment.status,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(payment)

    return to_response(payment)


@router.get(
    "/payments",
    response_model=list[PaymentResponse],
)
async def list_payments(
    invoice_id: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
    ),
    search: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    query = (
        select(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
    )

    if not await FinanceAccessService.can_view_all(
        db,
        current_user,
    ):
        conditions = []

        if current_user.person_id:
            conditions.append(
                Invoice.created_by_id == current_user.person_id
            )

        from app.models.sql.project import Project

        project_manager_subquery = select(Project.id).where(
            Project.manager_id == current_user.person_id
        )

        conditions.append(
            Invoice.project_id.in_(project_manager_subquery)
        )

        if conditions:
            query = query.where(or_(*conditions))
        else:
            query = query.where(False)

    if invoice_id:
        query = query.where(
            Payment.invoice_id == invoice_id
        )

    if status_filter:
        query = query.where(
            Payment.status == status_filter
        )

    if search:
        search_term = f"%{search.strip()}%"

        query = query.where(
            or_(
                Payment.payment_number.ilike(search_term),
                Payment.reference.ilike(search_term),
                Payment.payer_name.ilike(search_term),
                Invoice.invoice_number.ilike(search_term),
                Invoice.customer_name.ilike(search_term),
            )
        )

    query = (
        query
        .order_by(Payment.payment_date.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)

    payments = result.scalars().all()

    return [
        to_response(payment)
        for payment in payments
    ]


@router.get(
    "/payments/{payment_id}",
    response_model=PaymentResponse,
)
async def get_payment(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    payment = await get_payment_or_404(
        db,
        payment_id,
    )

    invoice = await get_invoice_or_404(
        db,
        payment.invoice_id,
    )

    await ensure_invoice_access(
        db,
        invoice,
        current_user,
    )

    return to_response(payment)


@router.patch(
    "/payments/{payment_id}",
    response_model=PaymentResponse,
)
async def update_payment(
    payment_id: str,
    payload: PaymentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.edit")
    ),
):
    payment = await get_payment_or_404(
        db,
        payment_id,
    )

    invoice = await get_invoice_or_404(
        db,
        payment.invoice_id,
    )

    await ensure_invoice_access(
        db,
        invoice,
        current_user,
    )

    if payment.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cancelled payments cannot be edited",
        )

    old_values = {
        "amount": str(payment.amount),
        "payment_date": (
            payment.payment_date.isoformat()
            if payment.payment_date
            else None
        ),
        "payment_method": payment.payment_method,
        "reference": payment.reference,
        "payer_name": payment.payer_name,
        "payer_email": payment.payer_email,
        "notes": payment.notes,
    }

    if payload.amount is not None:
        current_other_paid = (
            await calculate_invoice_paid_amount(
                db,
                invoice.id,
            )
            - Decimal(str(payment.amount))
        )

        invoice_amount = Decimal(str(invoice.amount))

        if current_other_paid + payload.amount > invoice_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Updated payment would exceed the invoice amount",
            )

        payment.amount = payload.amount

    if payload.payment_date is not None:
        payment.payment_date = payload.payment_date

    if payload.payment_method is not None:
        payment.payment_method = payload.payment_method

    if payload.reference is not None:
        payment.reference = payload.reference

    if payload.payer_name is not None:
        payment.payer_name = payload.payer_name

    if payload.payer_email is not None:
        payment.payer_email = payload.payer_email

    if payload.notes is not None:
        payment.notes = payload.notes

    await db.flush()

    await refresh_invoice_payment_status(
        db,
        invoice,
    )

    new_values = {
        "amount": str(payment.amount),
        "payment_date": (
            payment.payment_date.isoformat()
            if payment.payment_date
            else None
        ),
        "payment_method": payment.payment_method,
        "reference": payment.reference,
        "payer_name": payment.payer_name,
        "payer_email": payment.payer_email,
        "notes": payment.notes,
    }

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAYMENT_UPDATED",
        entity_type="Payment",
        entity_id=str(payment.id),
        description=(
            f"Payment {payment.payment_number} updated"
        ),
        old_values=old_values,
        new_values=new_values,
        request=request,
    )

    await db.commit()
    await db.refresh(payment)

    return to_response(payment)


@router.post(
    "/payments/{payment_id}/cancel",
    response_model=PaymentResponse,
)
async def cancel_payment(
    payment_id: str,
    payload: PaymentCancellation,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.edit")
    ),
):
    payment = await get_payment_or_404(
        db,
        payment_id,
    )

    invoice = await get_invoice_or_404(
        db,
        payment.invoice_id,
    )

    await ensure_invoice_access(
        db,
        invoice,
        current_user,
    )

    if payment.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment is already cancelled",
        )

    old_values = {
        "status": payment.status,
        "amount": str(payment.amount),
        "invoice_id": str(payment.invoice_id),
    }

    payment.status = "cancelled"

    await db.flush()

    await refresh_invoice_payment_status(
        db,
        invoice,
    )

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAYMENT_CANCELLED",
        entity_type="Payment",
        entity_id=str(payment.id),
        description=(
            f"Payment {payment.payment_number} cancelled. "
            f"Reason: {payload.reason}"
        ),
        old_values=old_values,
        new_values={
            "status": "cancelled",
            "reason": payload.reason,
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "invoice_amount_paid": str(invoice.amount_paid),
            "invoice_status": invoice.status,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(payment)

    return to_response(payment)