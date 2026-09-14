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


# =============================================
# ROLE SECURITY RULES
# =============================================

PROTECTED_ROLES = {"ceo"}
SUPER_ADMIN_ONLY_ROLES = {"ceo"}


def get_role_names(user: User) -> List[str]:
    """Return the user's assigned role names."""
    return [role.name for role in user.roles]


def can_assign_roles(current_user: User, role_names: List[str]) -> bool:
    """Only the CEO can assign protected roles such as CEO."""
    requested_roles = {role.lower() for role in role_names}

    if requested_roles.intersection(SUPER_ADMIN_ONLY_ROLES):
        return any(
            role.name.lower() == "ceo"
            for role in current_user.roles
        )

    return True


# =============================================
# GET ALL USERS
# =============================================

@router.get("/", response_model=List[ManagedUserResponse])
async def get_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.USERS_MANAGE)
    ),
):
    """Get all users. Requires users.manage permission."""

    result = await db.execute(
        select(User, Person)
        .join(Person, User.person_id == Person.id)
        .options(selectinload(User.roles))
    )
    rows = result.all()

    users = []

    for user, person in rows:
        users.append(
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

    return users


# =============================================
# CREATE USER LOGIN ACCESS
# =============================================

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
    """Create login access for an existing Person."""

    # Find the existing Person.
    result = await db.execute(
        select(Person).where(Person.id == user_data.person_id)
    )
    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found",
        )

    # A Person should only have one login account.
    result = await db.execute(
        select(User).where(User.person_id == person.id)
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This person already has a user account",
        )

    # The Person's email becomes the login email.
    if not person.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Person must have an email address before "
                "login access can be created"
            ),
        )

    # Validate requested roles.
    requested_role_names = [
        name.strip().lower()
        for name in user_data.role_names
    ]

    if not can_assign_roles(
        current_user,
        requested_role_names,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the CEO can assign the CEO role",
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
            set(requested_role_names) - found_role_names
        )

        if missing_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid role(s): "
                    f"{', '.join(sorted(missing_roles))}"
                ),
            )

    # Create the User login account.
    user = User(
        person_id=person.id,
        email=person.email,
        password_hash=get_password_hash(user_data.password),
        is_active=True,
        must_change_password=True,
    )

    user.roles = roles

    db.add(user)
    await db.commit()

    # Reload the user with roles before building the response.
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user.id)
    )
    user = result.scalar_one()

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


# =============================================
# UPDATE USER
# =============================================

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
    """Update a user. Requires users.manage permission."""

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

    result = await db.execute(
        select(Person).where(Person.id == user.person_id)
    )
    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found",
        )

    current_user_is_ceo = any(
        role.name.lower() == "ceo"
        for role in current_user.roles
    )

    target_is_ceo = any(
        role.name.lower() == "ceo"
        for role in user.roles
    )

    # Protect the CEO/Super Admin account.
    if target_is_ceo and not current_user_is_ceo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The CEO account is protected",
        )

    # A user cannot deactivate their own account.
    if (
        user.id == current_user.id
        and user_data.is_active is False
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    # Prevent deactivating the last active CEO.
    if user_data.is_active is False and target_is_ceo:
        result = await db.execute(
            select(func.count(User.id))
            .join(User.roles)
            .where(
                Role.name == "ceo",
                User.is_active.is_(True),
            )
        )
        active_ceo_count = result.scalar() or 0

        if active_ceo_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the last active CEO",
            )

    # Update roles if supplied.
    if user_data.role_names is not None:
        target_role_names = [
            name.strip().lower()
            for name in user_data.role_names
        ]

        if not can_assign_roles(
            current_user,
            target_role_names,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the CEO can assign the CEO role",
            )

        result = await db.execute(
            select(Role).where(
                Role.name.in_(target_role_names)
            )
        )
        roles = result.scalars().all()

        found_role_names = {
            role.name.lower()
            for role in roles
        }

        missing_roles = (
            set(target_role_names) - found_role_names
        )

        if missing_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid role(s): "
                    f"{', '.join(sorted(missing_roles))}"
                ),
            )

        currently_ceo = any(
            role.name.lower() == "ceo"
            for role in user.roles
        )

        remains_ceo = "ceo" in target_role_names

        # Prevent removing CEO from the last CEO account.
        if currently_ceo and not remains_ceo:
            result = await db.execute(
                select(func.count(User.id))
                .join(User.roles)
                .where(Role.name == "ceo")
            )
            ceo_count = result.scalar() or 0

            if ceo_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Cannot remove the CEO role from "
                        "the last CEO"
                    ),
                )

        user.roles = roles

    # Update active status.
    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    # An administrator-set password becomes a temporary password.
    if user_data.password:
        user.password_hash = get_password_hash(
            user_data.password
        )
        user.must_change_password = True

    await db.commit()

    # Reload with roles after the update.
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user.id)
    )
    user = result.scalar_one()

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


# =============================================
# DELETE USER LOGIN ACCESS
# =============================================

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
    """Delete a user login account."""

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

    # Prevent self-deletion.
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )

    # Never allow the CEO/Super Admin account to be deleted.
    target_is_ceo = any(
        role.name.lower() == "ceo"
        for role in user.roles
    )

    if target_is_ceo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "The CEO account is protected and "
                "cannot be deleted"
            ),
        )

    await db.delete(user)
    await db.commit()