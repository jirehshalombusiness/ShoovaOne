from sqlalchemy import Column, String, Boolean, ForeignKey, Table, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.sql.base import BaseModel, Base
from app.core.config import settings

# Determine column type based on database
if settings.DATABASE_URL.startswith("sqlite://"):
    FK_TYPE = String(36)
    ID_TYPE = String(36)
else:
    FK_TYPE = UUID(as_uuid=True)
    ID_TYPE = UUID(as_uuid=True)

# Association tables
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', FK_TYPE, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', FK_TYPE, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)

role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', FK_TYPE, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    Column('permission_id', FK_TYPE, ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)


class Role(BaseModel):
    __tablename__ = 'roles'
    
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String)
    is_system = Column(Boolean, default=False)
    
    # Relationships
    users = relationship('User', secondary=user_roles, back_populates='roles')
    permissions = relationship('Permission', secondary=role_permissions, back_populates='roles')


class Permission(BaseModel):
    __tablename__ = 'permissions'
    
    resource = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False)
    description = Column(String)
    
    # Relationships
    roles = relationship('Role', secondary=role_permissions, back_populates='permissions')