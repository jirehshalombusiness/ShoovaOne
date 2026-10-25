from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.permission_catalog import CANONICAL_PERMISSIONS, PERMISSION_CATALOG
from app.models.sql.core.user import User
from app.models.sql.core.role import Role, Permission, user_roles


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

        result = await db.execute(
            select(Role.id)
            .join(
                user_roles,
                Role.id == user_roles.c.role_id,
            )
            .where(
                user_roles.c.user_id == user_id,
                Role.name == role_name,
            )
            .limit(1)
        )

        return result.first() is not None

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
        """

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

        result = await db.execute(
            select(Role.name)
            .join(
                user_roles,
                Role.id == user_roles.c.role_id,
            )
            .where(
                user_roles.c.user_id == user_id
            )
        )

        return [row[0] for row in result.all()]