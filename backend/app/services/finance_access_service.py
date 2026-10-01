from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sql.fund_request import FundRequest
from app.models.sql.project import Project
from app.models.sql.user import User
from app.services.permission_service import PermissionService


class FinanceAccessService:
    """
    Controls Finance data visibility.

    Permission answers:
        "Can this user use Finance?"

    Scope answers:
        "Which Finance records can this user see?"

    Organisation-wide Finance access is granted to:
        - CEO
        - Executive Director
        - recognised Finance leadership roles
        - users with finance.manage

    Other Finance users remain scoped to:
        - their own fund requests
        - projects they manage
    """

    ORG_WIDE_ROLES = {
        "ceo",
        "executive_director",
        "finance_manager",
        "finance_officer",
        "head_of_finance",
    }

    ORG_WIDE_FINANCE_PERMISSION = "finance.manage"

    @staticmethod
    async def can_view_all(
        db: AsyncSession,
        user: User,
    ) -> bool:
        """
        Determine whether the user can view organisation-wide
        Finance records.

        This is intentionally separate from finance.view.

        finance.view:
            Allows entry into Finance.

        finance.manage:
            Grants organisation-wide Finance management scope.
        """

        roles = await PermissionService.get_user_roles(
            db,
            user.id,
        )

        if any(
            role in FinanceAccessService.ORG_WIDE_ROLES
            for role in roles
        ):
            return True

        permissions = await PermissionService.get_user_permissions(
            db,
            user.id,
        )

        return (
            FinanceAccessService.ORG_WIDE_FINANCE_PERMISSION
            in permissions
        )

    @staticmethod
    async def apply_view_scope(
        db: AsyncSession,
        query,
        user: User,
    ):
        """
        Apply Finance visibility scope to a query.

        Organisation-wide Finance users:
            See all records.

        Other Finance users:
            See their own fund requests and requests
            connected to projects they manage.
        """

        if await FinanceAccessService.can_view_all(
            db,
            user,
        ):
            return query

        conditions = [
            FundRequest.requester_id == user.person_id,
        ]

        project_manager_subquery = (
            select(Project.id)
            .where(
                Project.manager_id == user.person_id
            )
        )

        conditions.append(
            FundRequest.project_id.in_(
                project_manager_subquery
            )
        )

        return query.where(
            or_(*conditions)
        )