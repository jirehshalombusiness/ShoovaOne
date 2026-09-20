from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sql.fund_request import FundRequest
from app.models.sql.project import Project
from app.models.sql.user import User
from app.services.permission_service import PermissionService


class FinanceAccessService:

    ORG_WIDE_ROLES = {
        "ceo",
        "executive_director",
        "finance_manager",
        "finance_officer",
    }

    @staticmethod
    async def can_view_all(
        db: AsyncSession,
        user: User,
    ) -> bool:
        roles = await PermissionService.get_user_roles(db, user.id)

        return any(role in FinanceAccessService.ORG_WIDE_ROLES for role in roles)

    @staticmethod
    async def apply_view_scope(
        db: AsyncSession,
        query,
        user: User,
    ):
        if await FinanceAccessService.can_view_all(db, user):
            return query

        conditions = [
            FundRequest.requester_id == user.person_id,
        ]

        project_manager_subquery = (
            select(Project.id)
            .where(Project.manager_id == user.person_id)
        )

        conditions.append(
            FundRequest.project_id.in_(project_manager_subquery)
        )

        return query.where(or_(*conditions))