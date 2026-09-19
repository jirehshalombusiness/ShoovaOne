from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.core.security import (
    require_permission,
    Permissions,
    get_password_hash,
)
from app.models.sql.user import User, Person
from app.models.sql.role import (
    Role,
    Permission,
    user_permissions,
)
from app.models.pydantic.user import (
    ManagedUserCreate,
    ManagedUserUpdate,
    ManagedUserResponse,
    DirectPermissionRequest,
)
from app.services.permission_service import PermissionService
from app.services.audit_service import AuditService


router = APIRouter()


# ============================================================
# ROLE SECURITY RULES
# ============================================================

PROTECTED_ROLES = {"ceo"}

# Only the CEO can assign protected roles.
SUPER_ADMIN_ONLY_ROLES = {
    "ceo",
    "system_admin",
    "executive_director",
    "head_of_hr",
}

# These permissions can grant significant administrative authority.
# They must not be granted directly by a System Administrator to
# another user because doing so could create privilege escalation.
PROTECTED_DIRECT_PERMISSIONS = {
    Permissions.USERS_MANAGE,
    Permissions.ROLES_MANAGE,
    "system.manage",
}
# Permissions that only the CEO may grant directly.
CEO_ONLY_DIRECT_PERMISSIONS = {
    Permissions.USERS_MANAGE,
    Permissions.ROLES_MANAGE,
    "system.manage",
}
# Roles allowed to manage granular permissions.
GRANULAR_PERMISSION_MANAGERS = {
    "ceo",
    "system_admin",
}


def get_role_names(user: User) -> set[str]:
    """Return the role names assigned to a user."""
    return {
        role.name.lower()
        for role in user.roles
    }


def can_assign_roles(
    current_user: User,
    requested_role_names: set[str],
) -> bool:
    """
    Prevent non-CEO users from assigning protected roles.

    The CEO can assign any system role.
    Other users with users.manage cannot assign the CEO role.
    """

    if not requested_role_names:
        return True

    current_user_roles = get_role_names(current_user)
    is_super_admin = "ceo" in current_user_roles

    requested_roles = {
        role.strip().lower()
        for role in requested_role_names
    }

    protected_requested = (
        requested_roles & SUPER_ADMIN_ONLY_ROLES
    )

    if protected_requested and not is_super_admin:
        return False

    return True


def is_ceo(user: User) -> bool:
    """Return True when the user has the CEO role."""
    return "ceo" in get_role_names(user)

def can_manage_granular_permissions(user: User) -> bool:
    """Return True when the user may grant/revoke direct permissions."""
    return bool(
        get_role_names(user)
        & GRANULAR_PERMISSION_MANAGERS
    )

async def get_direct_permission_names(
    db: AsyncSession,
    user_id,
) -> list[str]:
    """
    Get permissions explicitly granted directly to a user.

    These are separate from permissions inherited through roles.
    """

    result = await db.execute(
        select(Permission)
        .join(
            user_permissions,
            Permission.id == user_permissions.c.permission_id,
        )
        .where(
            user_permissions.c.user_id == user_id
        )
    )

    permissions = result.scalars().all()

    return sorted(
        f"{permission.resource}.{permission.action}"
        for permission in permissions
    )


async def build_managed_user_response(
    db: AsyncSession,
    user: User,
    person: Person,
) -> ManagedUserResponse:
    """Build a managed-user response with effective and direct permissions."""

    effective_permissions = (
        await PermissionService.get_user_permissions(
            db,
            user.id,
        )
    )

    direct_permissions = (
        await get_direct_permission_names(
            db,
            user.id,
        )
    )

    return ManagedUserResponse(
        id=str(user.id),
        person_id=str(user.person_id),
        email=user.email,
        first_name=person.first_name,
        last_name=person.last_name,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        roles=sorted(get_role_names(user)),
        permissions=effective_permissions,
        direct_permissions=direct_permissions,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


# ============================================================
# GET ALL USERS
# ============================================================

@router.get(
    "/",
    response_model=List[ManagedUserResponse],
)
async def get_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.USERS_MANAGE)
    ),
):
    """
    Get all users.

    Requires users.manage permission.
    """

    result = await db.execute(
        select(User, Person)
        .join(
            Person,
            User.person_id == Person.id,
        )
        .options(
            selectinload(User.roles),
        )
    )

    rows = result.all()

    response = []

    for user, person in rows:
        response.append(
            await build_managed_user_response(
                db,
                user,
                person,
            )
        )

    return response


# ============================================================
# CREATE USER LOGIN ACCESS
# ============================================================
@router.post(
    "",
    response_model=ManagedUserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    user_data: ManagedUserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.USERS_MANAGE)
    ),
):
    """
    Create login access for an existing Person.

    Requires users.manage permission.
    """

    # --------------------------------------------------------
    # 1. Find Person
    # --------------------------------------------------------

    result = await db.execute(
        select(Person).where(
            Person.id == user_data.person_id
        )
    )

    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found",
        )

    # --------------------------------------------------------
    # 2. Check existing User account for this Person
    # --------------------------------------------------------

    result = await db.execute(
        select(User).where(
            User.person_id == person.id
        )
    )

    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This person already has a user account",
        )

    # --------------------------------------------------------
    # 3. Person must have an email
    # --------------------------------------------------------

    if not person.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Person must have an email address before "
                "login access can be created"
            ),
        )

    # --------------------------------------------------------
    # 4. Email must be unique
    # --------------------------------------------------------

    result = await db.execute(
        select(User).where(
            User.email == person.email
        )
    )

    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists",
        )

    # --------------------------------------------------------
    # 5. Validate requested roles
    # --------------------------------------------------------

    requested_role_names = {
        name.strip().lower()
        for name in user_data.role_names
    }

    # Changing/assigning roles requires roles.manage.
    if requested_role_names:
        can_manage_roles = await PermissionService.has_permission(
            db,
            current_user.id,
            Permissions.ROLES_MANAGE,
        )

        if not can_manage_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You do not have permission to assign user roles."
                ),
            )

    if not can_assign_roles(
        current_user,
        requested_role_names,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the CEO can assign the CEO role.",
        )

    roles = []

    if requested_role_names:
        result = await db.execute(
            select(Role).where(
                Role.name.in_(requested_role_names)
            )
        )

        roles = result.scalars().all()

        found_role_names = {
            role.name.lower()
            for role in roles
        }

        missing_roles = (
            requested_role_names
            - found_role_names
        )

        if missing_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Role(s) not found: "
                    f"{', '.join(sorted(missing_roles))}"
                ),
            )

    # --------------------------------------------------------
    # 6. Create User
    # --------------------------------------------------------

    user = User(
        person_id=person.id,
        email=person.email,
        password_hash=get_password_hash(
            user_data.password
        ),
        is_active=True,
        must_change_password=True,
    )

    user.roles = roles

    db.add(user)

    # --------------------------------------------------------
    # 7. Prepare User for audit
    # --------------------------------------------------------

    await db.flush()

    # --------------------------------------------------------
    # 8. Audit successful User creation
    # --------------------------------------------------------

    await AuditService.log(
        db=db,
        actor=current_user,
        action="USER_CREATED",
        entity_type="user",
        entity_id=user.id,
        description=(
            f"Created user account for {user.email}"
        ),
        old_values=None,
        new_values={
            "email": user.email,
            "person_id": str(user.person_id),
            "is_active": user.is_active,
            "must_change_password": user.must_change_password,
            "roles": [
                role.name
                for role in roles
            ],
        },
    )

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    # --------------------------------------------------------
    # 9. Reload with roles
    # --------------------------------------------------------

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.roles),
        )
        .where(User.id == user.id)
    )

    user = result.scalar_one()

    # --------------------------------------------------------
    # 10. Response
    # --------------------------------------------------------

    return await build_managed_user_response(
        db,
        user,
        person,
    )

# ============================================================
# UPDATE USER
# ============================================================

@router.patch(
    "/{user_id}",
    response_model=ManagedUserResponse,
)
async def update_user(
    user_id: str,
    user_data: ManagedUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.USERS_MANAGE)
    ),
):
    """
    Update a user's access, password, or roles.

    Requires users.manage permission.
    """

    # --------------------------------------------------------
    # 1. Find User
    # --------------------------------------------------------

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.roles),
        )
        .where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # --------------------------------------------------------
    # 2. Find associated Person
    # --------------------------------------------------------

    result = await db.execute(
        select(Person).where(
            Person.id == user.person_id
        )
    )

    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated person not found",
        )

    # --------------------------------------------------------
    # 3. Determine CEO status
    # --------------------------------------------------------

    current_user_roles = get_role_names(current_user)
    target_user_roles = get_role_names(user)

    current_user_is_super_admin = (
        "ceo" in current_user_roles
    )

    target_is_super_admin = (
        "ceo" in target_user_roles
    )

    # --------------------------------------------------------
    # 4. Prevent self-deactivation
    # --------------------------------------------------------

    if (
        str(user.id) == str(current_user.id)
        and user_data.is_active is False
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account.",
        )

    # --------------------------------------------------------
    # 5. Protect CEO account
    # --------------------------------------------------------

    if (
        target_is_super_admin
        and not current_user_is_super_admin
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only the CEO can modify "
                "the CEO account."
            ),
        )

    # --------------------------------------------------------
    # 6. Update active status
    # --------------------------------------------------------

    if user_data.is_active is not None:

        # Prevent deactivating the last active CEO
        if (
            target_is_super_admin
            and user_data.is_active is False
        ):
            result = await db.execute(
                select(User)
                .join(User.roles)
                .where(Role.name == "ceo")
            )

            ceo_users = result.scalars().all()

            active_ceo_count = sum(
                1
                for ceo_user in ceo_users
                if ceo_user.is_active
            )

            if active_ceo_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "The last active CEO "
                        "cannot be deactivated."
                    ),
                )

        old_is_active = user.is_active

        user.is_active = user_data.is_active

        if old_is_active != user_data.is_active:
            action = (
                "USER_ACTIVATED"
                if user_data.is_active
                else "USER_DEACTIVATED"
            )

            await AuditService.log(
                db=db,
                actor=current_user,
                action=action,
                entity_type="user",
                entity_id=user.id,
                description=(
                    f"{'Activated' if user_data.is_active else 'Deactivated'} "
                    f"user account for {user.email}"
                ),
                old_values={
                    "is_active": old_is_active,
                },
                new_values={
                    "is_active": user_data.is_active,
                },
            )

    # --------------------------------------------------------
    # 7. Update password
    # --------------------------------------------------------

    if user_data.password:

        user.password_hash = get_password_hash(
            user_data.password
        )

        # Force user to change the administrator-set password.
        user.must_change_password = True

    # --------------------------------------------------------
    # 8. Update roles
    # --------------------------------------------------------

    if user_data.role_names is not None:

        # Changing roles requires the separate roles.manage permission.
        # users.manage alone must not allow role assignment.
        can_manage_roles = await PermissionService.has_permission(
            db,
            current_user.id,
            Permissions.ROLES_MANAGE,
        )

        if not can_manage_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You do not have permission to manage user roles."
                ),
            )

        requested_role_names = {
            name.strip().lower()
            for name in user_data.role_names
        }

        # Prevent unauthorized privilege escalation
        if not can_assign_roles(
            current_user,
            requested_role_names,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You are not authorized to assign "
                    "one or more of these roles."
                ),
            )

        # A non-CEO cannot modify a CEO's roles
        if (
            target_is_super_admin
            and not current_user_is_super_admin
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only the CEO can modify "
                    "the CEO's roles."
                ),
            )

        result = await db.execute(
            select(Role).where(
                Role.name.in_(requested_role_names)
            )
        )

        roles = result.scalars().all()

        found_role_names = {
            role.name.lower()
            for role in roles
        }

        missing_roles = (
            requested_role_names
            - found_role_names
        )

        if missing_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Role(s) not found: "
                    f"{', '.join(sorted(missing_roles))}"
                ),
            )

        # ----------------------------------------------------
        # Prevent removing CEO from the last CEO
        # ----------------------------------------------------

        currently_ceo = (
            "ceo" in target_user_roles
        )

        remains_ceo = (
            "ceo" in requested_role_names
        )

        if currently_ceo and not remains_ceo:

            result = await db.execute(
                select(User)
                .join(User.roles)
                .where(Role.name == "ceo")
            )

            ceo_users = result.scalars().all()

            active_ceo_users = [
                ceo_user
                for ceo_user in ceo_users
                if ceo_user.is_active
            ]

            if len(active_ceo_users) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "The last CEO must "
                        "retain the CEO role."
                    ),
                )

        new_role_names = {role.name.lower() for role in roles}

        if target_user_roles != new_role_names:
            await AuditService.log(
                db=db,
                actor=current_user,
                action="ROLE_CHANGED",
                entity_type="user",
                entity_id=user.id,
                description=f"Changed roles for user {user.email}",
                old_values={"roles": sorted(target_user_roles)},
                new_values={"roles": sorted(new_role_names)},
            )

        user.roles = roles

    # --------------------------------------------------------
    # 9. Save
    # --------------------------------------------------------

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    # Reload with roles
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.roles),
        )
        .where(User.id == user.id)
    )

    user = result.scalar_one()

    # --------------------------------------------------------
    # 10. Response
    # --------------------------------------------------------

    return await build_managed_user_response(
        db,
        user,
        person,
    )
# ============================================================
# GET AVAILABLE PERMISSIONS
# ============================================================

@router.get(
    "/permissions/available",
)
async def get_available_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.USERS_MANAGE)
    ),
):
    """
    Get all permissions available for direct assignment.

    Requires users.manage permission.
    """

    if not can_manage_granular_permissions(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to manage granular permissions.",
        )

    result = await db.execute(
        select(Permission).order_by(
            Permission.resource,
            Permission.action,
        )
    )

    permissions = result.scalars().all()

    return [
        {
            "id": str(permission.id),
            "resource": permission.resource,
            "action": permission.action,
            "name": f"{permission.resource}.{permission.action}",
            "description": permission.description,
        }
        for permission in permissions
    ]

# ============================================================
# GET USER PERMISSIONS
# ============================================================

@router.get(
    "/{user_id}/permissions",
)
async def get_user_permissions(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.USERS_MANAGE)
    ),
):
    """
    Get a user's effective and direct permissions.

    Effective permissions include role-based and direct permissions.
    Direct permissions contain only permissions explicitly granted
    to the individual user.
    """

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.roles)
            .selectinload(Role.permissions),
        )
        .where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    effective_permissions = (
        await PermissionService.get_user_permissions(
            db,
            user.id,
        )
    )

    direct_permissions = (
        await get_direct_permission_names(
            db,
            user.id,
        )
    )

    return {
        "user_id": str(user.id),
        "roles": sorted(get_role_names(user)),
        "permissions": effective_permissions,
        "direct_permissions": direct_permissions,
    }


# ============================================================
# GRANT DIRECT PERMISSION
# ============================================================

@router.post(
    "/{user_id}/permissions",
    status_code=status.HTTP_201_CREATED,
)
async def grant_direct_permission(
    user_id: str,
    permission_data: DirectPermissionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.USERS_MANAGE)
    ),
):
    """
    Grant one direct permission to a user.

    The permission is stored separately from role permissions.

    System Administrators can grant normal operational permissions,
    but cannot directly grant administrative permissions that would
    create privilege escalation.

    The CEO can grant any defined permission.
    """
    # --------------------------------------------------------
    # Granular permission management authorization
    # --------------------------------------------------------

    if not can_manage_granular_permissions(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to manage granular permissions.",
        )

    # --------------------------------------------------------
    # 1. Normalize permission
    # --------------------------------------------------------

    requested_permission = (
        permission_data.permission
        .strip()
        .lower()
    )

    if (
        not requested_permission
        or "." not in requested_permission
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Permission must use the format "
                "'resource.action'."
            ),
        )

    # --------------------------------------------------------
    # 2. Find target user
    # --------------------------------------------------------

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.roles),
        )
        .where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # --------------------------------------------------------
    # 3. Protect CEO account
    # --------------------------------------------------------

    if is_ceo(user) and not is_ceo(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the CEO can manage permissions for the CEO account.",
        )

    # --------------------------------------------------------
    # 4. Protect administrative permissions
    # --------------------------------------------------------

    if (
        requested_permission in CEO_ONLY_DIRECT_PERMISSIONS
        and not is_ceo(current_user)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "This administrative permission can only "
                "be granted by the CEO."
            ),
        )

        # --------------------------------------------------------
    # Prevent self-granting permissions
    # --------------------------------------------------------

    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot grant permissions to yourself.",
        )

    # --------------------------------------------------------
    # 5. Find permission definition
    # --------------------------------------------------------

    resource, action = requested_permission.split(
        ".",
        1,
    )

    result = await db.execute(
        select(Permission).where(
            Permission.resource == resource,
            Permission.action == action,
        )
    )

    permission = result.scalar_one_or_none()

    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permission not found: {requested_permission}",
        )

    # --------------------------------------------------------
    # 6. Prevent duplicate direct grant
    # --------------------------------------------------------

    result = await db.execute(
        select(user_permissions).where(
            user_permissions.c.user_id == user.id,
            user_permissions.c.permission_id == permission.id,
        )
    )

    existing_grant = result.first()

    if existing_grant:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Permission already granted directly: "
                f"{requested_permission}"
            ),
        )

    # --------------------------------------------------------
    # 7. Create direct grant
    # --------------------------------------------------------

    await db.execute(
        user_permissions.insert().values(
            user_id=user.id,
            permission_id=permission.id,
            granted_by=current_user.id,
        )
    )

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PERMISSION_GRANTED",
        entity_type="user",
        entity_id=user.id,
        description=(
            f"Granted direct permission {requested_permission} "
            f"to {user.email}"
        ),
        old_values={"permission": None},
        new_values={
            "permission": requested_permission,
            "permission_id": str(permission.id),
        },
    )

    # --------------------------------------------------------
    # 8. Save
    # --------------------------------------------------------

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return {
        "message": "Permission granted successfully.",
        "user_id": str(user.id),
        "permission": requested_permission,
        "granted_by": str(current_user.id),
    }


# ============================================================
# REVOKE DIRECT PERMISSION
# ============================================================

@router.delete(
    "/{user_id}/permissions/{permission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_direct_permission(
    user_id: str,
    permission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.USERS_MANAGE)
    ),
):
    """
    Revoke one direct permission from a user.

    This only removes the direct grant.

    If the user still receives the same permission through a role,
    they will continue to have that permission.
    """

    # --------------------------------------------------------
    # Granular permission management authorization
    # --------------------------------------------------------

    if not can_manage_granular_permissions(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to manage granular permissions.",
        )

    # --------------------------------------------------------
    # 1. Find target user
    # --------------------------------------------------------

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.roles),
        )
        .where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # --------------------------------------------------------
    # 2. Protect CEO account
    # --------------------------------------------------------

    if is_ceo(user) and not is_ceo(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the CEO can manage permissions for the CEO account.",
        )

    # --------------------------------------------------------
    # 3. Validate permission UUID
    # --------------------------------------------------------

    try:
        permission_uuid = UUID(permission_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid permission ID.",
        )   

    # --------------------------------------------------------
    # 4. Find direct grant
    # --------------------------------------------------------

    result = await db.execute(
        select(Permission)
        .join(
            user_permissions,
            Permission.id == user_permissions.c.permission_id,
        )
        .where(
            user_permissions.c.user_id == user.id,
            Permission.id == permission_uuid,
        )
    )

    permission = result.scalar_one_or_none()

    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Direct permission grant not found.",
        )

    # --------------------------------------------------------
# Protect CEO-only administrative permissions
# --------------------------------------------------------

    if (
        f"{permission.resource}.{permission.action}"
        in CEO_ONLY_DIRECT_PERMISSIONS
        and not is_ceo(current_user)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only the CEO can revoke protected "
                "administrative permissions."
            ),
        )    

    # --------------------------------------------------------
    # 5. Remove direct grant
    # --------------------------------------------------------

    await db.execute(
        user_permissions.delete().where(
            user_permissions.c.user_id == user.id,
            user_permissions.c.permission_id == permission.id,
        )
    )

    requested_permission = f"{permission.resource}.{permission.action}"

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PERMISSION_REVOKED",
        entity_type="user",
        entity_id=user.id,
        description=(
            f"Revoked direct permission {requested_permission} "
            f"from {user.email}"
        ),
        old_values={
            "permission": requested_permission,
            "permission_id": str(permission.id),
        },
        new_values={"permission": None},
    )

    # --------------------------------------------------------
    # 6. Save
    # --------------------------------------------------------

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return None


# ============================================================
# DELETE USER LOGIN ACCESS
# ============================================================

@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.USERS_MANAGE)
    ),
):
    """
    Permanently delete a user login account.

    This removes the User account and its access/role assignments.
    The associated Person/HR record is preserved.

    Requires users.manage permission.
    """

    # --------------------------------------------------------
    # 1. Find User
    # --------------------------------------------------------

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.roles),
        )
        .where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # --------------------------------------------------------
    # 2. Prevent self-deletion
    # --------------------------------------------------------

    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account.",
        )

    # --------------------------------------------------------
    # 3. Protect CEO
    # --------------------------------------------------------

    target_user_roles = get_role_names(user)

    if "ceo" in target_user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The CEO account cannot be deleted.",
        )

    # --------------------------------------------------------
    # 4. Capture account details for audit
    # --------------------------------------------------------

    old_values = {
        "email": user.email,
        "person_id": str(user.person_id),
        "is_active": user.is_active,
        "roles": sorted(target_user_roles),
    }

    # --------------------------------------------------------
    # 5. Delete login account
    # --------------------------------------------------------

    await db.delete(user)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="USER_DELETED",
        entity_type="user",
        entity_id=user.id,
        description=f"Deleted user account for {user.email}",
        old_values=old_values,
        new_values={"deleted": True},
    )

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return None