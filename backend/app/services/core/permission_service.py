from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.permission_catalog import CANONICAL_PERMISSIONS, PERMISSION_CATALOG
from app.models.sql.core.user import User
from app.models.sql.core.role import Role, Permission, user_roles


# Request-scoped caches live on the AsyncSession's user-modifiable ``info``
# dict, so they are discarded automatically when the request's session closes.
_PERMISSION_CACHE_KEY = "_shoova_permission_cache"
_ROLE_CACHE_KEY = "_shoova_role_cache"


def _permission_cache(db: AsyncSession) -> dict[str, list[str]]:
    cache = db.info.get(_PERMISSION_CACHE_KEY)
    if cache is None:
        cache = {}
        db.info[_PERMISSION_CACHE_KEY] = cache
    return cache


def _role_cache(db: AsyncSession) -> dict[str, list[str]]:
    cache = db.info.get(_ROLE_CACHE_KEY)
    if cache is None:
        cache = {}
        db.info[_ROLE_CACHE_KEY] = cache
    return cache


def clear_permission_cache(
    db: AsyncSession,
    user_id: str | None = None,
) -> None:
    """Drop cached permissions/roles for one user, or for the whole session."""

    if user_id is None:
        db.info.pop(_PERMISSION_CACHE_KEY, None)
        db.info.pop(_ROLE_CACHE_KEY, None)
        return

    key = str(user_id)
    _permission_cache(db).pop(key, None)
    _role_cache(db).pop(key, None)


class PermissionService:

    @staticmethod
    async def ensure_permission_catalog(db: AsyncSession) -> int:
        """Insert any catalog permission missing from the database.

        Idempotent and safe to run on every startup. Returns the number of
        permissions that were created.
        """

        result = await db.execute(
            select(Permission.resource, Permission.action)
        )
        existing = {(resource, action) for resource, action in result.all()}

        missing = [
            Permission(
                resource=resource,
                action=action,
                description=description,
            )
            for resource, action, description in PERMISSION_CATALOG
            if (resource, action) not in existing
        ]

        if not missing:
            return 0

        db.add_all(missing)

        try:
            await db.commit()
        except IntegrityError:
            # Another worker inserted the same rows concurrently.
            await db.rollback()
            return 0

        return len(missing)

    @staticmethod
    async def user_has_role(
        db: AsyncSession,
        user_id: str,
        role_name: str,
    ) -> bool:
        """Check whether a user is assigned a specific role."""

        roles = await PermissionService.get_user_roles(db, user_id)

        return role_name.lower() in {role.lower() for role in roles}

    @staticmethod
    async def get_user_permissions(
        db: AsyncSession,
        user_id: str,
    ) -> list[str]:
        """
        Get all effective permissions for a user.

        Effective permissions come from:
        1. The user's roles
        2. Direct permissions granted to the user

        CEO has full system access.

        Results are cached for the lifetime of the request's AsyncSession,
        so the many ``require_permission`` dependencies in a single request
        only trigger one permission lookup.
        """

        key = str(user_id)
        cache = _permission_cache(db)

        cached = cache.get(key)
        if cached is not None:
            return list(cached)

        permissions = await PermissionService._load_user_permissions(
            db,
            key,
        )

        cache[key] = permissions

        return list(permissions)

    @staticmethod
    async def _load_user_permissions(
        db: AsyncSession,
        user_id: str,
    ) -> list[str]:
        # Load user with roles + role permissions + direct permissions.
        result = await db.execute(
            select(User)
            .options(
                selectinload(User.roles).selectinload(Role.permissions),
                selectinload(User.direct_permissions),
            )
            .where(User.id == user_id)
        )

        user = result.scalar_one_or_none()

        if not user:
            return []

        # ---------------------------------------------------------
        # CEO = full system access
        # ---------------------------------------------------------
        if any(role.name == "ceo" for role in user.roles):
            result = await db.execute(
                select(Permission)
            )

            all_permissions = result.scalars().all()

            # Union with the canonical catalog so newly shipped permissions
            # are effective even before their rows reach the database.
            permission_names = {
                f"{permission.resource}.{permission.action}"
                for permission in all_permissions
            }
            permission_names.update(CANONICAL_PERMISSIONS)

            return sorted(permission_names)

        # ---------------------------------------------------------
        # Role permissions
        # ---------------------------------------------------------
        permissions = set()

        for role in user.roles:
            for permission in role.permissions:
                permissions.add(
                    f"{permission.resource}.{permission.action}"
                )

        # ---------------------------------------------------------
        # Direct user permissions
        # ---------------------------------------------------------
        for permission in user.direct_permissions:
            permissions.add(
                f"{permission.resource}.{permission.action}"
            )

        return sorted(permissions)

    @staticmethod
    async def has_permission(
        db: AsyncSession,
        user_id: str,
        permission: str,
    ) -> bool:
        """Check whether a user has a specific effective permission."""

        permissions = await PermissionService.get_user_permissions(
            db,
            user_id,
        )

        if permission in permissions:
            return True

        # The CEO has full system access, even for a permission string that
        # is newer than the deployed permission catalog.
        return await PermissionService.user_has_role(
            db,
            user_id,
            "ceo",
        )

    @staticmethod
    async def get_user_roles(
        db: AsyncSession,
        user_id: str,
    ) -> list[str]:
        """Get all role names for a user."""

        key = str(user_id)
        cache = _role_cache(db)

        cached = cache.get(key)
        if cached is not None:
            return list(cached)

        result = await db.execute(
            select(Role.name)
            .join(
                user_roles,
                Role.id == user_roles.c.role_id,
            )
            .where(
                user_roles.c.user_id == key
            )
        )

        roles = [row[0] for row in result.all()]
        cache[key] = roles

        return list(roles)