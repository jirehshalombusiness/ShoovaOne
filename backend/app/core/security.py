from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.models.sql.user import User
from app.models.sql.role import Role
from app.services.permission_service import PermissionService

# Password context for bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password using bcrypt."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"Password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)

    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get current user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Load user with person relationship
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.person),
            selectinload(User.roles).selectinload(Role.permissions)
        )
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user = Depends(get_current_user),
):
    """Get current active user."""

    if not current_user.is_active:
        raise HTTPException(
            status_code=400,
            detail="Inactive user",
        )

    # Users with a temporary password must change it
    # before accessing protected parts of the system.
    if current_user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required",
        )

    return current_user

def require_permission(permission: str):
    """
    Dependency factory to check if current user has a specific permission.
    
    Usage:
        @router.get("/endpoint")
        async def endpoint(
            current_user = Depends(require_permission("people.view")),
        ):
            ...
    """
    async def permission_dependency(
        current_user = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db),
    ):
        has_perm = await PermissionService.has_permission(db, current_user.id, permission)
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission} required"
            )
        return current_user
    return permission_dependency


def require_any_permission(permissions: List[str]):
    """
    Dependency factory to check if user has ANY of the specified permissions.
    """
    async def permission_dependency(
        current_user = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db),
    ):
        for permission in permissions:
            if await PermissionService.has_permission(db, current_user.id, permission):
                return current_user
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: Requires one of {permissions}"
        )
    return permission_dependency


def require_all_permissions(permissions: List[str]):
    """
    Dependency factory to check if user has ALL of the specified permissions.
    """
    async def permission_dependency(
        current_user = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db),
    ):
        for permission in permissions:
            if not await PermissionService.has_permission(db, current_user.id, permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {permission} required"
                )
        return current_user
    return permission_dependency


# Common permission constants for easy reference
class Permissions:
    # ============================================
    # PEOPLE
    # ============================================
    PEOPLE_VIEW = "people.view"
    PEOPLE_CREATE = "people.create"
    PEOPLE_EDIT = "people.edit"
    PEOPLE_DELETE = "people.delete"
    
    # ============================================
    # HR (Sensitive)
    # ============================================
    HR_VIEW_SENSITIVE = "hr.view_sensitive"
    HR_EDIT_SENSITIVE = "hr.edit_sensitive"
    HR_VIEW_EMPLOYMENT = "hr.view_employment"
    HR_EDIT_EMPLOYMENT = "hr.edit_employment"
    HR_VIEW_COMPENSATION = "hr.view_compensation"
    HR_EDIT_COMPENSATION = "hr.edit_compensation"
    HR_VIEW_LEAVE = "hr.view_leave"
    HR_EDIT_LEAVE = "hr.edit_leave"
    HR_VIEW_PERFORMANCE = "hr.view_performance"
    HR_EDIT_PERFORMANCE = "hr.edit_performance"
    HR_VIEW_BASIC = "hr.view_basic"
    
    # ============================================
    # TIMESHEETS
    # ============================================
    TIMESHEETS_VIEW = "timesheets.view"
    TIMESHEETS_SUBMIT = "timesheets.submit"
    TIMESHEETS_APPROVE = "timesheets.approve"
    TIMESHEETS_EDIT_ANY = "timesheets.edit_any"

    # ============================================
    # ORGANISATION
    # ============================================
    ORGANISATION_VIEW = "organisation.view"
    ORGANISATION_MANAGE = "organisation.manage"

   
    
    # ============================================
    # PROJECTS
    # ============================================
    PROJECTS_VIEW = "projects.view"
    PROJECTS_CREATE = "projects.create"
    PROJECTS_EDIT = "projects.edit"
    PROJECTS_DELETE = "projects.delete"
    
    # ============================================
    # TASKS
    # ============================================
    TASKS_VIEW = "tasks.view"
    TASKS_CREATE = "tasks.create"
    TASKS_EDIT = "tasks.edit"
    TASKS_DELETE = "tasks.delete"
    
    # ============================================
    # CRM
    # ============================================
    CRM_VIEW = "crm.view"
    CRM_CREATE = "crm.create"
    CRM_EDIT = "crm.edit"
    CRM_DELETE = "crm.delete"
    
    # ============================================
    # FINANCE
    # ============================================
    FINANCE_VIEW = "finance.view"
    FINANCE_APPROVE = "finance.approve"

    # ============================================
    # USERS & ROLES
    # ============================================
    USERS_MANAGE = "users.manage"
    ROLES_MANAGE = "roles.manage"

    # ============================================
    # AUDIT
    # ============================================

    AUDIT_VIEW = "audit.view"

    # ============================================
    # EVENTS
    # ============================================
    EVENTS_VIEW = "events.view"
    EVENTS_CREATE = "events.create"
    EVENTS_EDIT = "events.edit"
    
    # ============================================
    # ATTENDANCE
    # ============================================
    ATTENDANCE_VIEW = "attendance.view"
    ATTENDANCE_CHECKIN = "attendance.checkin"
    ATTENDANCE_EDIT = "attendance.edit"
    
    # ============================================
    # PROGRAMMES
    # ============================================
    PROGRAMMES_VIEW = "programmes.view"
    PROGRAMMES_CREATE = "programmes.create"
    PROGRAMMES_EDIT = "programmes.edit"
    
    # ============================================
    # DOCUMENTS
    # ============================================
    DOCUMENTS_VIEW = "documents.view"
    DOCUMENTS_UPLOAD = "documents.upload"


    