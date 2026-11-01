"""Outbound transactional email (Resend).

Messages are queued on the current SQLAlchemy session and only handed to
Resend after that session commits. A rollback discards the queue, so smoke
tests and failed transactions can never deliver email.

Set EMAIL_TEST_REDIRECT_TO to funnel every message to a single test inbox
while seeded accounts still carry placeholder addresses.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date
from decimal import Decimal
from html import escape
from typing import Any, Optional

import resend
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.sql.core.user import Person, User

logger = logging.getLogger(__name__)

QUEUE_KEY = "pending_emails"

BRAND_GREEN = "#176b4d"
BRAND_DARK = "#0f513a"
BRAND_GOLD = "#c79a35"
INK = "#122019"
MUTED = "#5b6b62"
PAPER = "#f4f7f5"
BORDER = "#e2eae5"

STAGE_LABELS = {
    "manager": "manager",
    "finance": "finance",
    "hr": "HR",
    "ceo": "CEO",
    "exec": "executive",
    "fulfilment": "fulfilment",
}


# ============================================================
# RENDERING
# ============================================================

def _fmt_date(value: Optional[date]) -> str:
    if not value:
        return ""
    return value.strftime("%d %b %Y").lstrip("0")


def _fmt_money(amount: Any, currency: str) -> str:
    try:
        return f"{currency} {Decimal(str(amount)):,.2f}"
    except Exception:
        return f"{currency} {amount}"


def _app_link(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _button(url: str, label: str) -> str:
    return (
        f'<p style="margin:26px 0 8px;">'
        f'<a href="{escape(url)}" style="display:inline-block;'
        f"padding:12px 22px;background:{BRAND_GREEN};color:#ffffff;"
        f"text-decoration:none;border-radius:8px;font-weight:600;"
        f'font-size:14px;">{escape(label)}</a></p>'
    )


def _details(rows: list[tuple[str, str]]) -> str:
    if not rows:
        return ""
    cells = "".join(
        f'<tr><td style="padding:7px 0;color:{MUTED};font-size:13px;'
        f'width:44%;">{label}</td>'
        f'<td style="padding:7px 0;color:{INK};font-size:13px;'
        f'font-weight:600;">{value}</td></tr>'
        for label, value in rows
    )
    return (
        f'<table role="presentation" width="100%" cellpadding="0" '
        f'cellspacing="0" style="background:{PAPER};border:1px solid '
        f'{BORDER};border-radius:10px;padding:6px 16px;margin:18px 0;">'
        f"{cells}</table>"
    )


def render_layout(
    *,
    title: str,
    body_html: str,
    preheader: str = "",
) -> str:
    """Shared branded shell with the Shoova signature block."""
    year = date.today().year
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:#eef3ef;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
{escape(preheader)}
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
 style="background:#eef3ef;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0"
 style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;
 overflow:hidden;border:1px solid {BORDER};
 font-family:'Segoe UI',Arial,Helvetica,sans-serif;">

  <tr>
    <td style="background:{BRAND_GREEN};padding:22px 32px;">
      <span style="color:#ffffff;font-size:20px;font-weight:700;
 letter-spacing:3px;">SHOOVA</span>
      <span style="color:{BRAND_GOLD};font-size:20px;font-weight:700;
 letter-spacing:3px;">&nbsp;ONE</span>
    </td>
  </tr>
  <tr><td style="height:3px;background:{BRAND_GOLD};"></td></tr>

  <tr>
    <td style="padding:34px 32px 12px;">
      <h1 style="margin:0 0 18px;color:{INK};font-size:21px;
 line-height:1.35;font-weight:700;">{escape(title)}</h1>
      <div style="color:{INK};font-size:15px;line-height:1.65;">
        {body_html}
      </div>
    </td>
  </tr>

  <tr>
    <td style="padding:8px 32px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0"
 style="margin-top:26px;border-top:1px solid {BORDER};padding-top:18px;
 width:100%;">
        <tr>
          <td width="46" valign="top" style="padding-top:2px;">
            <div style="width:38px;height:38px;border-radius:9px;
 background:{BRAND_GREEN};color:#ffffff;text-align:center;
 line-height:38px;font-weight:700;font-size:17px;">S</div>
          </td>
          <td style="padding-left:12px;">
            <div style="color:{INK};font-size:14px;font-weight:700;">
              Shoova People &amp; Operations</div>
            <div style="color:{MUTED};font-size:12.5px;line-height:1.5;">
              Shoova Initiative &middot; Shoova ONE<br>
              people@shoove.org
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="background:{PAPER};border-top:1px solid {BORDER};
 padding:16px 32px;color:{MUTED};font-size:11.5px;line-height:1.6;">
      This is an automated message from Shoova ONE. If you were not
      expecting it, you can safely ignore it.<br>
      &copy; {year} Shoova Initiative. All rights reserved.
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def _greeting(first_name: Optional[str]) -> str:
    name = escape(first_name) if first_name else "there"
    return f"<p style=\"margin:0 0 14px;\">Hello {name},</p>"


def _paragraph(text: str) -> str:
    return f'<p style="margin:0 0 14px;">{escape(text)}</p>'


def _quoted(text: Optional[str]) -> str:
    if not text:
        return ""
    return (
        f'<blockquote style="margin:14px 0;padding:10px 16px;'
        f'border-left:3px solid {BRAND_GOLD};background:{PAPER};'
        f'color:{MUTED};font-size:13.5px;">{escape(text)}</blockquote>'
    )


# ============================================================
# DELIVERY
# ============================================================

def _redirect(to: str, subject: str) -> tuple[str, str]:
    redirect = settings.EMAIL_TEST_REDIRECT_TO.strip()
    if not redirect:
        return to, subject
    return redirect, f"[Test → {to}] {subject}"


def queue_email(
    db: AsyncSession,
    *,
    to: Optional[str],
    subject: str,
    html: str,
) -> None:
    """Queue a message for delivery after the current transaction commits."""
    if not to or "@" not in to:
        return
    to, subject = _redirect(to.strip(), subject)
    db.info.setdefault(QUEUE_KEY, []).append(
        {"to": to, "subject": subject, "html": html}
    )


async def person_contact(
    db: AsyncSession,
    person_id,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Return (login email, first name, full name) for a person."""
    if not person_id:
        return None, None, None
    row = (
        await db.execute(
            select(User.email, Person.first_name, Person.last_name)
            .join(Person, Person.id == User.person_id)
            .where(User.person_id == person_id, User.is_active.is_(True))
            .execution_options(include_all_entities=True)
        )
    ).first()
    if not row:
        return None, None, None
    email, first_name, last_name = row
    full_name = f"{first_name} {last_name}".strip()
    return email, first_name, full_name


async def queue_person_email(
    db: AsyncSession,
    *,
    person_id,
    subject: str,
    html: str,
) -> None:
    email, _, _ = await person_contact(db, person_id)
    queue_email(db, to=email, subject=subject, html=html)


async def _deliver(payload: dict) -> bool:
    if not settings.EMAIL_ENABLED:
        logger.info(
            "email disabled; skipped to=%s subject=%s",
            payload["to"],
            payload["subject"],
        )
        return False

    if not settings.RESEND_API_KEY:
        logger.warning(
            "RESEND_API_KEY not configured; skipped to=%s subject=%s",
            payload["to"],
            payload["subject"],
        )
        return False

    resend.api_key = settings.RESEND_API_KEY
    params: dict[str, Any] = {
        "from": settings.EMAIL_FROM,
        "to": [payload["to"]],
        "subject": payload["subject"],
        "html": payload["html"],
    }
    if settings.EMAIL_REPLY_TO:
        params["reply_to"] = settings.EMAIL_REPLY_TO

    try:
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(
            "email sent to=%s subject=%s", payload["to"], payload["subject"]
        )
        return True
    except Exception:
        logger.exception(
            "email delivery failed to=%s subject=%s",
            payload["to"],
            payload["subject"],
        )
        return False


async def deliver_queued(payloads: list[dict]) -> None:
    for payload in payloads:
        await _deliver(payload)


async def send_now(*, to: str, subject: str, html: str) -> bool:
    return await _deliver(
        {"to": to, "subject": subject, "html": html}
    )


# ============================================================
# NOTIFICATIONS
# ============================================================

async def queue_approval_assigned(
    db: AsyncSession,
    *,
    approval,
    requester_name: str,
) -> None:
    email, first_name, _ = await person_contact(db, approval.assigned_to_id)
    if not email:
        return

    stage = STAGE_LABELS.get(approval.stage or "manager", "approval")
    summary = _paragraph(approval.summary) if approval.summary else ""
    link = _app_link(f"/me/approvals/{approval.id}")

    body = (
        _greeting(first_name)
        + _paragraph(
            f"{requester_name} submitted a request that needs your "
            f"{stage} decision."
        )
        + _details(
            [
                ("Request", escape(approval.title)),
                ("Submitted by", escape(requester_name)),
                ("Your stage", escape(stage.title())),
            ]
        )
        + summary
        + _button(link, "Review request")
        + _paragraph("You can approve or reject it from your approval inbox.")
    )

    queue_email(
        db,
        to=email,
        subject=f"Action needed: {approval.title}",
        html=render_layout(
            title="An approval is waiting for you",
            body_html=body,
            preheader=f"{requester_name} submitted {approval.title}",
        ),
    )


async def queue_request_rejected(
    db: AsyncSession,
    *,
    person_id,
    title: str,
    actor_name: str,
    note: str,
    link: str,
) -> None:
    email, first_name, _ = await person_contact(db, person_id)
    if not email:
        return

    body = (
        _greeting(first_name)
        + _paragraph(f"{actor_name} rejected your request: {title}.")
        + _quoted(note)
        + _button(_app_link(link), "View request")
        + _paragraph(
            "You can review the decision and submit an updated request "
            "if needed."
        )
    )
    queue_email(
        db,
        to=email,
        subject=f"Request rejected: {title}",
        html=render_layout(
            title="Your request was rejected",
            body_html=body,
            preheader=f"{actor_name} rejected {title}",
        ),
    )


async def queue_leave_approved(
    db: AsyncSession,
    *,
    person_id,
    start_date: date,
    end_date: date,
    total_days: Any,
    leave_type: Optional[str] = None,
) -> None:
    email, first_name, _ = await person_contact(db, person_id)
    if not email:
        return

    body = (
        _greeting(first_name)
        + _paragraph("Your leave request has been fully approved.")
        + _details(
            [
                ("Leave type", escape(leave_type or "Leave")),
                ("From", _fmt_date(start_date)),
                ("To", _fmt_date(end_date)),
                ("Days", escape(str(total_days))),
            ]
        )
        + _button(_app_link("/me/leave"), "View leave")
    )
    queue_email(
        db,
        to=email,
        subject="Your leave is approved",
        html=render_layout(
            title="Leave approved",
            body_html=body,
            preheader="Your leave request was approved",
        ),
    )


async def queue_fund_approved(
    db: AsyncSession,
    *,
    person_id,
    request_number: str,
    approved_amount: Any,
    currency: str,
) -> None:
    email, first_name, _ = await person_contact(db, person_id)
    if not email:
        return

    body = (
        _greeting(first_name)
        + _paragraph(
            f"Your fund request {request_number} is fully approved. "
            f"Finance will arrange payment."
        )
        + _details(
            [
                ("Request", escape(request_number)),
                (
                    "Approved amount",
                    escape(_fmt_money(approved_amount, currency)),
                ),
            ]
        )
        + _button(_app_link("/me/finance"), "View request")
    )
    queue_email(
        db,
        to=email,
        subject=f"Fund request {request_number} approved",
        html=render_layout(
            title="Fund request approved",
            body_html=body,
            preheader=f"{request_number} is fully approved",
        ),
    )


async def queue_fund_disbursed(
    db: AsyncSession,
    *,
    person_id,
    request_number: str,
    amount: Any,
    currency: str,
) -> None:
    email, first_name, _ = await person_contact(db, person_id)
    if not email:
        return

    body = (
        _greeting(first_name)
        + _paragraph(
            f"Payment has been released for {request_number}. Submit the "
            f"signed hardcopy receipts to Finance for verification."
        )
        + _details(
            [
                ("Request", escape(request_number)),
                ("Amount released", escape(_fmt_money(amount, currency))),
            ]
        )
        + _button(_app_link("/me/finance"), "View request")
    )
    queue_email(
        db,
        to=email,
        subject=f"Payment released for {request_number}",
        html=render_layout(
            title="Payment released",
            body_html=body,
            preheader=f"{request_number} was paid",
        ),
    )


async def queue_device_approved(
    db: AsyncSession,
    *,
    person_id,
    request_number: str,
    item_name: str,
) -> None:
    email, first_name, _ = await person_contact(db, person_id)
    if not email:
        return

    body = (
        _greeting(first_name)
        + _paragraph(
            f"HR approved your device request. They will arrange the "
            f"equipment and notify you when it is ready."
        )
        + _details(
            [
                ("Request", escape(request_number)),
                ("Item", escape(item_name)),
            ]
        )
        + _button(_app_link("/me/devices"), "View request")
    )
    queue_email(
        db,
        to=email,
        subject=f"Device request {request_number} approved",
        html=render_layout(
            title="Device request approved",
            body_html=body,
            preheader=f"{request_number} was approved",
        ),
    )


async def queue_device_ordered(
    db: AsyncSession,
    *,
    person_id,
    request_number: str,
    item_name: str,
) -> None:
    email, first_name, _ = await person_contact(db, person_id)
    if not email:
        return

    body = (
        _greeting(first_name)
        + _paragraph(
            f"HR has ordered the equipment for your request. You will be "
            f"notified when it is assigned to you."
        )
        + _details(
            [
                ("Request", escape(request_number)),
                ("Item", escape(item_name)),
            ]
        )
        + _button(_app_link("/me/devices"), "View request")
    )
    queue_email(
        db,
        to=email,
        subject="Your equipment is on order",
        html=render_layout(
            title="Equipment on order",
            body_html=body,
            preheader=f"{item_name} is on order",
        ),
    )


async def queue_device_ready(
    db: AsyncSession,
    *,
    person_id,
    request_number: str,
    device_name: str,
) -> None:
    email, first_name, _ = await person_contact(db, person_id)
    if not email:
        return

    body = (
        _greeting(first_name)
        + _paragraph(
            f"{device_name} has been assigned to you against "
            f"{request_number}."
        )
        + _button(_app_link("/me/devices"), "View my devices")
    )
    queue_email(
        db,
        to=email,
        subject="Your device is ready",
        html=render_layout(
            title="Device assigned",
            body_html=body,
            preheader=f"{device_name} is now yours",
        ),
    )


async def queue_compensation_approved(
    db: AsyncSession,
    *,
    person_id,
    amount: Any,
    currency: str,
    frequency: Optional[str] = None,
) -> None:
    email, first_name, _ = await person_contact(db, person_id)
    if not email:
        return

    rows = [("New amount", escape(_fmt_money(amount, currency)))]
    if frequency:
        rows.append(("Frequency", escape(frequency.title())))

    body = (
        _greeting(first_name)
        + _paragraph("Your compensation change has been fully approved.")
        + _details(rows)
        + _button(_app_link("/me/profile"), "View profile")
    )
    queue_email(
        db,
        to=email,
        subject="Your compensation change is approved",
        html=render_layout(
            title="Compensation approved",
            body_html=body,
            preheader="Your compensation change was approved",
        ),
    )


async def queue_timesheet_submitted(
    db: AsyncSession,
    *,
    approver_person_id,
    submitter_name: str,
    week_start: date,
) -> None:
    email, first_name, _ = await person_contact(db, approver_person_id)
    if not email:
        return

    body = (
        _greeting(first_name)
        + _paragraph(
            f"{submitter_name} submitted a timesheet for the week "
            f"beginning {_fmt_date(week_start)}."
        )
        + _button(_app_link("/timesheets?tab=team"), "Review timesheet")
    )
    queue_email(
        db,
        to=email,
        subject="Timesheet awaiting your approval",
        html=render_layout(
            title="A timesheet needs approval",
            body_html=body,
            preheader=f"{submitter_name} submitted a timesheet",
        ),
    )


async def queue_timesheet_approved(
    db: AsyncSession,
    *,
    person_id,
    week_start: date,
) -> None:
    email, first_name, _ = await person_contact(db, person_id)
    if not email:
        return

    body = (
        _greeting(first_name)
        + _paragraph(
            f"Your timesheet for the week beginning {_fmt_date(week_start)} "
            f"has been approved."
        )
        + _button(_app_link("/timesheets"), "View timesheet")
    )
    queue_email(
        db,
        to=email,
        subject="Your timesheet is approved",
        html=render_layout(
            title="Timesheet approved",
            body_html=body,
            preheader="Your timesheet was approved",
        ),
    )


async def queue_timesheet_reminder(
    db: AsyncSession,
    *,
    person_id,
    week_start: date,
) -> None:
    email, first_name, _ = await person_contact(db, person_id)
    if not email:
        return

    body = (
        _greeting(first_name)
        + _paragraph(
            f"Our records show your timesheet for the week beginning "
            f"{_fmt_date(week_start)} has not been submitted yet."
        )
        + _paragraph(
            "Payroll is prepared from approved timesheets, so please "
            "submit yours as soon as possible."
        )
        + _button(_app_link("/timesheets"), "Submit timesheet")
    )
    queue_email(
        db,
        to=email,
        subject=f"Reminder: submit your timesheet for {_fmt_date(week_start)}",
        html=render_layout(
            title="Timesheet reminder",
            body_html=body,
            preheader="Please submit your timesheet for payroll",
        ),
    )


async def queue_payment_made(
    db: AsyncSession,
    *,
    person_id,
    amount: Any,
    currency: str,
    period_name: Optional[str],
    pay_date: Optional[date],
) -> None:
    email, first_name, _ = await person_contact(db, person_id)
    if not email:
        return

    rows = [("Amount paid", escape(_fmt_money(amount, currency)))]
    if period_name:
        rows.append(("Pay period", escape(period_name)))
    if pay_date:
        rows.append(("Pay date", _fmt_date(pay_date)))

    body = (
        _greeting(first_name)
        + _paragraph("Your salary payment has been made.")
        + _details(rows)
        + _button(_app_link("/me/payslips"), "View payslips")
        + _paragraph(
            "If anything looks wrong, contact the People team."
        )
    )
    queue_email(
        db,
        to=email,
        subject="Your salary has been paid",
        html=render_layout(
            title="Payment made",
            body_html=body,
            preheader="Your salary payment has been processed",
        ),
    )
