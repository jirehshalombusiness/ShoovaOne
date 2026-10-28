import time
from decimal import Decimal

import pytest

from app.services.core import permission_service
from app.services.core.permission_service import (
    PermissionService,
    clear_permission_cache,
)
from app.services.finance import currency_service


class _FakePermission:
    def __init__(self, resource, action):
        self.resource = resource
        self.action = action


class _FakeRole:
    def __init__(self, name, permissions=()):
        self.name = name
        self.permissions = list(permissions)


class _FakeUser:
    def __init__(self, roles, direct_permissions=()):
        self.id = "user-1"
        self.roles = list(roles)
        self.direct_permissions = list(direct_permissions)


class _FakeScalars:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _FakeResult:
    def __init__(self, user, role_rows):
        self._user = user
        self._role_rows = role_rows

    def scalar_one_or_none(self):
        return self._user

    def scalars(self):
        return _FakeScalars([])

    def all(self):
        return self._role_rows


class _FakeSession:
    """Minimal stand-in that counts queries and exposes ``info``."""

    def __init__(self, user, role_rows):
        self.info = {}
        self._result = _FakeResult(user, role_rows)
        self.execute_calls = 0

    async def execute(self, _statement):
        self.execute_calls += 1
        return self._result


@pytest.mark.asyncio
async def test_permission_lookup_is_cached_per_session():
    user = _FakeUser(
        roles=[_FakeRole("staff", [_FakePermission("projects", "view")])]
    )
    db = _FakeSession(user, role_rows=[])

    first = await PermissionService.get_user_permissions(db, "user-1")
    second = await PermissionService.get_user_permissions(db, "user-1")

    assert first == ["projects.view"]
    assert second == ["projects.view"]
    assert db.execute_calls == 1

    clear_permission_cache(db, "user-1")

    await PermissionService.get_user_permissions(db, "user-1")
    assert db.execute_calls == 2


@pytest.mark.asyncio
async def test_role_lookup_is_cached_per_session():
    user = _FakeUser(roles=[])
    db = _FakeSession(user, role_rows=[("staff",)])

    first = await PermissionService.get_user_roles(db, "user-1")
    second = await PermissionService.get_user_roles(db, "user-1")

    assert first == ["staff"]
    assert second == ["staff"]
    assert db.execute_calls == 1
    assert await PermissionService.user_has_role(db, "user-1", "STAFF")
    assert db.execute_calls == 1


@pytest.mark.asyncio
async def test_exchange_rate_cache_avoids_second_provider_call(monkeypatch):
    currency_service.clear_rate_cache()

    calls = []

    class _FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"rate": 0.085}

    class _FakeClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_exc):
            return False

        async def get(self, url):
            calls.append(url)
            return _FakeResponse()

    monkeypatch.setattr(
        currency_service.httpx,
        "AsyncClient",
        _FakeClient,
    )

    first = await currency_service.get_exchange_rate("ghs", "usd")
    second = await currency_service.get_exchange_rate("GHS", "USD")

    assert first == Decimal("0.085")
    assert second == Decimal("0.085")
    assert len(calls) == 1


def test_exchange_rate_cache_respects_ttl():
    currency_service.clear_rate_cache()

    expired_key = ("GHS", "USD")
    currency_service._rate_cache[expired_key] = (
        time.monotonic() - 1,
        Decimal("0.1"),
    )

    assert currency_service._cached_rate(*expired_key) is None
    assert expired_key not in currency_service._rate_cache


def test_permission_cache_key_is_namespaced():
    assert permission_service._PERMISSION_CACHE_KEY.startswith("_shoova_")
    assert permission_service._ROLE_CACHE_KEY.startswith("_shoova_")
