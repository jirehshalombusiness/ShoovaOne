"""Send the leadership progress update to the launch stakeholder list.

Uses the branded transactional layout and bypasses EMAIL_TEST_REDIRECT_TO so
each recipient receives the message directly.

Usage: PYTHONPATH=. python scripts/send_progress_update.py [--dry-run]
"""

import asyncio
import os
import sys

# Must be set before app.core.config is imported so the settings object picks
# it up. This broadcast is meant for the real recipients.
os.environ["EMAIL_TEST_REDIRECT_TO"] = ""

from app.services.core import email_service  # noqa: E402

RECIPIENTS = [
    "quesijulius@gmail.com",
    "ksappiahus@yahoo.com",
    "oponyeboah@gmail.com",
    "agyekumwilliam01@gmail.com",
    "salagyekum1@gmail.com",
    "kwaappiah1982@gmail.com",
    "sheilarichlyn9@gmail.com",
]

SUBJECT = "Shoova ONE - request, approval and payroll workflows are ready"


def _item(title: str, text: str) -> str:
    return (
        f'<tr><td style="padding:6px 0;vertical-align:top;width:16px;'
        f'color:{email_service.BRAND_GOLD};font-size:15px;font-weight:700;">'
        f'&bull;</td>'
        f'<td style="padding:6px 0 6px 8px;color:{email_service.INK};'
        f'font-size:14.5px;line-height:1.6;">'
        f'<strong>{title}</strong><br>{text}</td></tr>'
    )


def build_body() -> str:
    items = [
        (
            "Requests and approvals, end to end",
            "Leave, fund requests, devices and compensation all follow a fixed "
            "route to the right approver. Nobody can approve their own request, "
            "and every decision is recorded.",
        ),
        (
            "Finance controls",
            "Budgets, allocations, expenses, invoices, payments, reimbursements "
            "and receipt verification - with the person requesting kept separate "
            "from the person approving.",
        ),
        (
            "Timesheets and attendance",
            "Weekly timesheets record effective working time, are submitted to a "
            "supervisor for approval, and can be gently reminded so payroll is "
            "never held up.",
        ),
        (
            "Payroll",
            "Pay groups are created, a pay run calculates automatically, then "
            "moves through HR review, finance review and final approval. "
            "Payslips and every disbursement are tracked to the last payment.",
        ),
        (
            "People and operations",
            "Org chart, staff directory, profiles, documents and contracts, "
            "devices, events, programmes and cohorts, projects, tasks, meetings "
            "and CRM - all in one place.",
        ),
        (
            "Email that respects inboxes",
            "An approver gets one email when a request reaches their desk. The "
            "requester gets one email when it is finally approved or rejected. "
            "Staff get timesheet reminders and payment confirmations.",
        ),
        (
            "Security and accountability",
            "Role-based permissions on every module, a full audit log, protected "
            "sessions and login safeguards.",
        ),
    ]
    rows = "".join(_item(title, text) for title, text in items)
    return (
        '<p style="margin:0 0 14px;">Hello team,</p>'
        '<p style="margin:0 0 14px;">A quick, plain update on Shoova ONE and what '
        "it can already do for us.</p>"
        '<p style="margin:0 0 8px;font-weight:700;">Now live</p>'
        f'<table role="presentation" width="100%" cellpadding="0" '
        f'cellspacing="0" style="margin:0 0 18px;">{rows}</table>'
        '<p style="margin:0 0 8px;font-weight:700;">What it means</p>'
        '<p style="margin:0 0 14px;">Fewer lost requests, faster decisions, '
        "payroll run from approved timesheets, and a clear trail for finance and "
        "HR to stand behind.</p>"
        '<p style="margin:0 0 8px;font-weight:700;">What is next</p>'
        '<p style="margin:0 0 14px;">We are rebuilding the organisation structure '
        "and setting up real accounts, then switching on live email "
        "notifications from our verified shoove.org domain. Target launch: the "
        "week of 2 November.</p>"
        '<p style="margin:0 0 14px;">Thank you for your patience and support.</p>'
    )


async def main() -> int:
    dry_run = "--dry-run" in sys.argv
    html = email_service.render_layout(
        title="Shoova ONE - progress update",
        preheader=(
            "Requests, approvals, timesheets and payroll are ready. Launch is "
            "targeted for the week of 2 November."
        ),
        body_html=build_body(),
    )
    if dry_run:
        print(f"dry run: {len(RECIPIENTS)} recipients, subject={SUBJECT!r}")
        return 0

    sent = 0
    for address in RECIPIENTS:
        ok = await email_service.send_now(to=address, subject=SUBJECT, html=html)
        print(f"{'sent ' if ok else 'FAIL '} {address}")
        sent += int(ok)
    print(f"delivered {sent}/{len(RECIPIENTS)}")
    return 0 if sent == len(RECIPIENTS) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
