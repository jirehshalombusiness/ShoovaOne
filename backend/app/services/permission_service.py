from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.sql.user import User
from app.models.sql.role import Role, Permission, user_roles, role_permissions


class PermissionService:
    @staticmethod
    async def get_user_permissions(db: AsyncSession, user_id: str) -> list[str]:
        """Get all permissions for a user."""
        # Get user with roles and permissions
        result = await db.execute(
            select(User)
            .options(
                selectinload(User.roles).selectinload(Role.permissions)
            )
            .where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return []
        
        # Collect all permissions
        permissions = set()
        for role in user.roles:
            for permission in role.permissions:
                permissions.add(f"{permission.resource}.{permission.action}")
        
        return list(permissions)

    @staticmethod
    async def has_permission(db: AsyncSession, user_id: str, permission: str) -> bool:
        """Check if a user has a specific permission."""
        permissions = await PermissionService.get_user_permissions(db, user_id)
        return permission in permissions

    @staticmethod
    async def get_user_roles(db: AsyncSession, user_id: str) -> list[str]:
        """Get all role names for a user."""
        result = await db.execute(
            select(Role.name)
            .join(user_roles, Role.id == user_roles.c.role_id)
            .where(user_roles.c.user_id == user_id)
        )
        return [row[0] for row in result.all()]