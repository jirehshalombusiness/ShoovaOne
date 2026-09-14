from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List

from app.core.database import get_db
from app.core.security import (
    require_permission,
    Permissions,
    get_password_hash,
)
from app.models.sql.user import User, Person
from app.models.sql.role import Role
from app.models.pydantic.user import (
    ManagedUserCreate,
    ManagedUserUpdate,
    ManagedUserResponse,
)


router = APIRouter()


# ============================================================
# ROLE SECURITY RULES
# ============================================================

PROTECTED_ROLES = {"ceo"}

# Only the Super Admin / CEO can assign protected roles.
SUPER_ADMIN_ONLY_ROLES = {"ceo"}


def get_role_names(user: User) -> set[str]:
    """Return the role names assigned to a user."""
    return {role.name.lower() for role in user.roles}


def can_assign_roles(
    current_user: User,
    requested_role_names: set[str],
) -> bool:
    """
    Prevent non-Super Admin users from assigning protected roles.

    The CEO/Super Admin can assign any system role.
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
        .join(Person, User.person_id == Person.id)
        .options(
            selectinload(User.roles),
        )
    )

    rows = result.all()

    response = []

    for user, person in rows:
        response.append(
            ManagedUserResponse(
                id=str(user.id),
                person_id=str(user.person_id),
                email=user.email,
                first_name=person.first_name,
                last_name=person.last_name,
                is_active=user.is_active,
                must_change_password=user.must_change_password,
                roles=get_role_names(user),
                last_login_at=user.last_login_at,
                created_at=user.created_at,
                updated_at=user.updated_at,
            )
        )

    return response


# ============================================================
# CREATE USER LOGIN ACCESS
# ============================================================

@router.post(
    "/",
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

    if not can_assign_roles(
        current_user,
        requested_role_names,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the Super Admin can assign the CEO role.",
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
    # 7. Save
    # --------------------------------------------------------

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    # Reload with roles
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user.id)
    )

    user = result.scalar_one()

    # --------------------------------------------------------
    # 8. Response
    # --------------------------------------------------------

    return ManagedUserResponse(
        id=str(user.id),
        person_id=str(user.person_id),
        email=user.email,
        first_name=person.first_name,
        last_name=person.last_name,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        roles=get_role_names(user),
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
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
        .options(selectinload(User.roles))
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
    # 3. Determine Super Admin status
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
    # 5. Protect Super Admin account
    # --------------------------------------------------------

    if (
        target_is_super_admin
        and not current_user_is_super_admin
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only the Super Admin can modify "
                "the Super Admin account."
            ),
        )

    # --------------------------------------------------------
    # 6. Update active status
    # --------------------------------------------------------

    if user_data.is_active is not None:

        # Prevent deactivating the last active Super Admin
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
                        "The last active Super Admin "
                        "cannot be deactivated."
                    ),
                )

        user.is_active = user_data.is_active

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
                    "Only the Super Admin can assign "
                    "the CEO role."
                ),
            )

        # A non-Super Admin cannot modify a Super Admin's roles
        if (
            target_is_super_admin
            and not current_user_is_super_admin
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only the Super Admin can modify "
                    "the Super Admin's roles."
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
        # Prevent removing CEO from the last Super Admin
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
                        "The last Super Admin must "
                        "retain the CEO role."
                    ),
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
        .options(selectinload(User.roles))
        .where(User.id == user.id)
    )

    user = result.scalar_one()

    # --------------------------------------------------------
    # 10. Response
    # --------------------------------------------------------

    return ManagedUserResponse(
        id=str(user.id),
        person_id=str(user.person_id),
        email=user.email,
        first_name=person.first_name,
        last_name=person.last_name,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        roles=get_role_names(user),
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


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
    Delete a user login account.

    Requires users.manage permission.
    """

    # --------------------------------------------------------
    # 1. Find User
    # --------------------------------------------------------

    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
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
    # 3. Protect Super Admin
    # --------------------------------------------------------

    target_user_roles = get_role_names(user)

    if "ceo" in target_user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The Super Admin account cannot be deleted.",
        )

    # --------------------------------------------------------
    # 4. Delete
    # --------------------------------------------------------

    try:
        await db.delete(user)
        await db.commit()
    except Exception:
        await db.rollback()
        raise