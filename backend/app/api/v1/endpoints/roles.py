from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_permission
from app.models.sql.role import Role, Permission, role_permissions
from app.models.sql.user import User
from app.schemas.role import (
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    RoleDetailResponse,
    PermissionResponse,
    RolePermissionsUpdate,
)
from app.services.audit_service import AuditService


router = APIRouter()


PROTECTED_SYSTEM_ROLES = {
    "ceo",
    "system_admin",
    "executive_director",
    "head_of_hr",
}


def serialize_permission(permission: Permission) -> PermissionResponse:
    return PermissionResponse(
        id=str(permission.id),
        resource=permission.resource,
        action=permission.action,
        description=permission.description,
    )


def serialize_role(role: Role) -> RoleResponse:
    return RoleResponse(
        id=str(role.id),
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        user_count=len(role.users) if role.users is not None else 0,
        permission_count=len(role.permissions) if role.permissions is not None else 0,
    )


def serialize_role_detail(role: Role) -> RoleDetailResponse:
    return RoleDetailResponse(
        id=str(role.id),
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        permissions=[
            serialize_permission(permission)
            for permission in role.permissions
        ],
        user_count=len(role.users) if role.users is not None else 0,
    )


@router.get(
    "",
    response_model=List[RoleResponse],
    dependencies=[Depends(require_permission("roles.manage"))],
)
async def get_roles(
    db: AsyncSession = Depends(get_db),
):
    """
    Return all roles available in the system.
    """

    result = await db.execute(
        select(Role)
        .options(
            selectinload(Role.permissions),
            selectinload(Role.users),
        )
        .order_by(Role.name.asc())
    )

    roles = result.scalars().unique().all()

    return [serialize_role(role) for role in roles]


@router.get(
    "/permissions",
    response_model=List[PermissionResponse],
    dependencies=[Depends(require_permission("roles.manage"))],
)
async def get_permissions(
    db: AsyncSession = Depends(get_db),
):
    """
    Return all permissions available for role assignment.
    """

    result = await db.execute(
        select(Permission).order_by(
            Permission.resource.asc(),
            Permission.action.asc(),
        )
    )

    permissions = result.scalars().all()

    return [
        serialize_permission(permission)
        for permission in permissions
    ]


@router.get(
    "/{role_id}",
    response_model=RoleDetailResponse,
    dependencies=[Depends(require_permission("roles.manage"))],
)
async def get_role(
    role_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Return one role together with its permissions.
    """

    result = await db.execute(
        select(Role)
        .options(
            selectinload(Role.permissions),
            selectinload(Role.users),
        )
        .where(Role.id == role_id)
    )

    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found.",
        )

    return serialize_role_detail(role)


@router.post(
    "",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("roles.manage"))],
)
async def create_role(
    payload: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a custom role.
    """

    role_name = payload.name.strip().lower()

    if not role_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role name is required.",
        )

    existing_result = await db.execute(
        select(Role).where(Role.name == role_name)
    )

    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A role with this name already exists.",
        )

    role = Role(
        name=role_name,
        description=payload.description,
        is_system=False,
    )

    db.add(role)
    await db.flush()

    await AuditService.log(
        db,
        actor=current_user,
        action="ROLE_CREATED",
        entity_type="Role",
        entity_id=role.id,
        description=f"Created role '{role.name}'.",
        new_values={
            "name": role.name,
            "description": role.description,
            "is_system": role.is_system,
        },
    )

    await db.commit()

    result = await db.execute(
        select(Role)
        .options(
            selectinload(Role.permissions),
            selectinload(Role.users),
        )
        .where(Role.id == role.id)
    )

    role = result.scalar_one()

    return serialize_role(role)


@router.patch(
    "/{role_id}",
    response_model=RoleResponse,
    dependencies=[Depends(require_permission("roles.manage"))],
)
async def update_role(
    role_id: str,
    payload: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a role's description/name.

    System role names cannot be changed.
    """

    result = await db.execute(
        select(Role)
        .options(
            selectinload(Role.permissions),
            selectinload(Role.users),
        )
        .where(Role.id == role_id)
    )

    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found.",
        )

    old_values = {
        "name": role.name,
        "description": role.description,
    }

    if payload.name is not None:
        new_name = payload.name.strip().lower()

        if not new_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role name cannot be empty.",
            )

        if role.is_system or role.name in PROTECTED_SYSTEM_ROLES:
            if new_name != role.name:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="System role names cannot be changed.",
                )

        duplicate_result = await db.execute(
            select(Role).where(
                Role.name == new_name,
                Role.id != role.id,
            )
        )

        if duplicate_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A role with this name already exists.",
            )

        role.name = new_name

    if payload.description is not None:
        role.description = payload.description

    await db.flush()

    await AuditService.log(
        db,
        actor=current_user,
        action="ROLE_UPDATED",
        entity_type="Role",
        entity_id=role.id,
        description=f"Updated role '{role.name}'.",
        old_values=old_values,
        new_values={
            "name": role.name,
            "description": role.description,
        },
    )

    await db.commit()

    return serialize_role(role)


@router.put(
    "/{role_id}/permissions",
    response_model=RoleDetailResponse,
    dependencies=[Depends(require_permission("roles.manage"))],
)
async def update_role_permissions(
    role_id: str,
    payload: RolePermissionsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Replace the permissions assigned to a role.
    """

    result = await db.execute(
        select(Role)
        .options(
            selectinload(Role.permissions),
            selectinload(Role.users),
        )
        .where(Role.id == role_id)
    )

    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found.",
        )

    permission_ids = list(dict.fromkeys(payload.permission_ids))

    permissions_result = await db.execute(
        select(Permission).where(
            Permission.id.in_(permission_ids)
        )
    )

    permissions = permissions_result.scalars().all()

    found_ids = {str(permission.id) for permission in permissions}
    missing_ids = [
        permission_id
        for permission_id in permission_ids
        if permission_id not in found_ids
    ]

    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "One or more permissions were not found.",
                "missing_permission_ids": missing_ids,
            },
        )

    old_permissions = [
        f"{permission.resource}.{permission.action}"
        for permission in role.permissions
    ]

    role.permissions = permissions

    await db.flush()

    new_permissions = [
        f"{permission.resource}.{permission.action}"
        for permission in permissions
    ]

    await AuditService.log(
        db,
        actor=current_user,
        action="ROLE_PERMISSIONS_UPDATED",
        entity_type="Role",
        entity_id=role.id,
        description=f"Updated permissions for role '{role.name}'.",
        old_values={
            "permissions": old_permissions,
        },
        new_values={
            "permissions": new_permissions,
        },
    )

    await db.commit()

    result = await db.execute(
        select(Role)
        .options(
            selectinload(Role.permissions),
            selectinload(Role.users),
        )
        .where(Role.id == role.id)
    )

    role = result.scalar_one()

    return serialize_role_detail(role)


@router.delete(
    "/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("roles.manage"))],
)
async def delete_role(
    role_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a custom role.

    System/protected roles cannot be deleted.
    Roles currently assigned to users cannot be deleted.
    """

    result = await db.execute(
        select(Role)
        .options(selectinload(Role.users))
        .where(Role.id == role_id)
    )

    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found.",
        )

    if role.is_system or role.name in PROTECTED_SYSTEM_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System roles cannot be deleted.",
        )

    if role.users:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This role is assigned to users and cannot be deleted.",
        )

    role_name = role.name
    role_id_value = role.id

    await AuditService.log(
        db,
        actor=current_user,
        action="ROLE_DELETED",
        entity_type="Role",
        entity_id=role_id_value,
        description=f"Deleted role '{role_name}'.",
        old_values={
            "name": role_name,
            "description": role.description,
            "is_system": role.is_system,
        },
    )

    await db.delete(role)
    await db.commit()

    return None