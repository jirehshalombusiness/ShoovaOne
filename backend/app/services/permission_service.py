from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.sql.user import User
from app.models.sql.role import Role, Permission, user_roles


class PermissionService:

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

            return sorted(
                f"{permission.resource}.{permission.action}"
                for permission in all_permissions
            )

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

        return permission in permissions

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