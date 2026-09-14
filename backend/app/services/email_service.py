import resend

from app.core.config import settings


def send_password_reset_email(
    recipient_email: str,
    recipient_name: str,
    reset_token: str,
) -> None:
    """
    Send a password reset email using Resend.
    """

    if not settings.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured")

    resend.api_key = settings.RESEND_API_KEY

    reset_url = (
        f"{settings.FRONTEND_URL}/reset-password/{reset_token}"
    )

    first_name = recipient_name or "there"

    resend.Emails.send(
        {
            "from": "Shoova ONE <onboarding@resend.dev>",
            "to": [recipient_email],
            "subject": "Reset your Shoova ONE password",
            "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <h2>Shoova ONE</h2>

                    <p>Hello {first_name},</p>

                    <p>
                        We received a request to reset your Shoova ONE password.
                    </p>

                    <p>
                        Click the button below to create a new password:
                    </p>

                    <p>
                        <a
                            href="{reset_url}"
                            style="
                                display: inline-block;
                                padding: 12px 20px;
                                background: #0D1B2A;
                                color: #ffffff;
                                text-decoration: none;
                                border-radius: 6px;
                            "
                        >
                            Reset Password
                        </a>
                    </p>

                    <p>
                        This link will expire in 30 minutes.
                    </p>

                    <p>
                        If you did not request a password reset,
                        you can safely ignore this email.
                    </p>

                    <p>
                        — Shoova ONE
                    </p>
                </div>
            """,
        }
    )