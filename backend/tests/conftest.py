import pytest

from app.services.core import email_service


@pytest.fixture(autouse=True)
def block_outbound_email(monkeypatch):
    """Keep tests off Resend and off the production database.

    The post-commit hook drains the outbox through AsyncSessionLocal, which
    in a developer checkout points at the live Supabase database. Tests that
    want to exercise delivery call drain_outbox_rows(session) directly.
    """

    async def _skip_drain(*args, **kwargs):
        return 0

    async def _fake_send(payload):
        return "sent", None

    monkeypatch.setattr(email_service, "drain_outbox", _skip_drain)
    monkeypatch.setattr(email_service, "_send", _fake_send)
