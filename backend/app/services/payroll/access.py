from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sql.core.user import User
from app.services.core.permission_service import PermissionService


class PayrollAccessService:
    ORG_WIDE_ROLES = {
        "ceo",
        "executive_director",
        "head_of_hr",
        "head_of_finance",
        "finance_manager",
        "finance_officer",
    }

    @staticmethod
    async def can_view_all(db: AsyncSession, user: User) -> bool:
        if await PermissionService.has_permission(
            db, user.id, "payroll.view_all"
        ):
            return True

        roles = await PermissionService.get_user_roles(db, user.id)
        return any(role in PayrollAccessService.ORG_WIDE_ROLES for role in roles)

    @staticmethod
    async def can_view_person(
        db: AsyncSession,
        user: User,
        person_id,
    ) -> bool:
        if user.person_id and str(user.person_id) == str(person_id):
            return True

        return await PayrollAccessService.can_view_all(db, user)

    @staticmethod
    async def can_prepare(db: AsyncSession, user: User) -> bool:
        return await PermissionService.has_permission(
            db, user.id, "payroll.prepare"
        )
