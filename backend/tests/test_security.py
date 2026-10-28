import uuid

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.rate_limit import SlidingWindowLimiter
from app.core.security import (
    password_fingerprint,
    validate_password_strength,
)
from app.api.v1.endpoints.core.documents import (
    _validate_entity_reference,
    _validate_file_metadata,
)


def _expect_bad_request(callable_):
    with pytest.raises(HTTPException) as exc_info:
        callable_()
    assert exc_info.value.status_code == 400
    return exc_info.value


def test_password_fingerprint_tracks_password_hash():
    first = password_fingerprint("hash-one")
    assert first
    assert first == password_fingerprint("hash-one")
    assert first != password_fingerprint("hash-two")
    assert password_fingerprint(None) == ""


def test_password_policy_accepts_long_passphrase():
    validate_password_strength(
        "correct horse battery staple",
        email="person@example.com",
    )


def test_password_policy_rejects_short_password():
    error = _expect_bad_request(
        lambda: validate_password_strength("short12345")
    )
    assert "12 characters" in error.detail


def test_password_policy_rejects_email_local_part():
    error = _expect_bad_request(
        lambda: validate_password_strength(
            "Emmanuel-2026-secure",
            email="emmanuel@example.com",
        )
    )
    assert "email" in error.detail.lower()


def test_password_policy_rejects_common_password():
    _expect_bad_request(
        lambda: validate_password_strength("password1234")
    )


@pytest.mark.asyncio
async def test_sliding_window_blocks_after_limit():
    limiter = SlidingWindowLimiter()
    key = "test-key"

    assert await limiter.retry_after(key, limit=2, window_seconds=60) == 0

    await limiter.record(key, window_seconds=60)
    await limiter.record(key, window_seconds=60)

    retry_after = await limiter.retry_after(
        key,
        limit=2,
        window_seconds=60,
    )
    assert retry_after > 0

    await limiter.reset(key)

    assert await limiter.retry_after(key, limit=2, window_seconds=60) == 0


def test_cors_origins_always_include_frontend():
    origins = settings.allowed_cors_origins
    assert "https://shoovaone.vercel.app" in origins
    assert "*" not in origins


def test_document_entity_reference_validation():
    valid_id = str(uuid.uuid4())

    _validate_entity_reference("person", valid_id)

    _expect_bad_request(
        lambda: _validate_entity_reference("unknown", valid_id)
    )
    _expect_bad_request(
        lambda: _validate_entity_reference("person", "not-a-uuid")
    )


def test_document_metadata_accepts_supabase_url():
    _validate_file_metadata(
        name="contract.pdf",
        file_url="https://example.supabase.co/storage/v1/object/public/docs/a.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
    )


def test_document_metadata_rejects_foreign_host():
    _expect_bad_request(
        lambda: _validate_file_metadata(
            name="contract.pdf",
            file_url="https://evil.example.com/a.pdf",
            file_size_bytes=1024,
            mime_type="application/pdf",
        )
    )


def test_document_metadata_rejects_http_and_bad_types():
    _expect_bad_request(
        lambda: _validate_file_metadata(
            name="contract.pdf",
            file_url="http://example.supabase.co/a.pdf",
            file_size_bytes=1024,
            mime_type="application/pdf",
        )
    )

    _expect_bad_request(
        lambda: _validate_file_metadata(
            name="payload.html",
            file_url="https://example.supabase.co/a.html",
            file_size_bytes=1024,
            mime_type="text/html",
        )
    )

    _expect_bad_request(
        lambda: _validate_file_metadata(
            name="empty.pdf",
            file_url="https://example.supabase.co/a.pdf",
            file_size_bytes=0,
            mime_type="application/pdf",
        )
    )
