"""Send one branded sample email so the layout can be reviewed.

Usage (from backend/):
    .venv/Scripts/python scripts/send_test_email.py [recipient]
"""

import asyncio
import logging
import sys

from app.services.core import email_service

DEFAULT_RECIPIENT = "quesijulius@gmail.com"


def sample_html() -> str:
    body = (
        '<p style="margin:0 0 14px;">Hello Quesi,</p>'
        '<p style="margin:0 0 14px;">This is a test of the Shoova ONE '
        "email channel. Request, approval, timesheet and payroll "
        "messages will use this layout.</p>"
        '<p style="margin:0 0 6px;font-weight:700;">'
        "What you will receive</p>"
        '<ul style="margin:0 0 14px;padding-left:20px;">'
        "<li>A request lands in an approver's inbox.</li>"
        "<li>The requester hears back only when the chain is decided.</li>"
        "<li>Staff get timesheet reminders before payroll runs.</li>"
        "<li>Employees get a confirmation once salary is paid.</li>"
        "</ul>"
        '<p style="margin:0 0 14px;">If anything looks off, reply to this '
        "message.</p>"
    )
    return email_service.render_layout(
        title="Your Shoova email channel is live",
        body_html=body,
        preheader="A test of the Shoova ONE email layout",
    )


async def main() -> int:
    logging.basicConfig(level=logging.INFO)
    recipient = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_RECIPIENT
    sent = await email_service.send_now(
        to=recipient,
        subject="Shoova ONE - email channel test",
        html=sample_html(),
    )
    print("sent" if sent else "not sent (check the log above)")
    return 0 if sent else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
