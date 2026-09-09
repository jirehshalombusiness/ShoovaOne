from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Date, Text, DECIMAL, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel
from app.core.config import settings

if settings.DATABASE_URL.startswith("sqlite://"):
    FK_TYPE = String(36)
else:
    FK_TYPE = UUID(as_uuid=True)


class Project(BaseModel):
    __tablename__ = "projects"

    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True)
    description = Column(Text)
    status = Column(String(50), default="planning")  # planning, active, on_hold, completed, cancelled
    start_date = Column(Date)
    end_date = Column(Date)
    priority = Column(String(20), default="medium")
    manager_id = Column(FK_TYPE, ForeignKey("people.id"), nullable=True)
    department_id = Column(String(36), nullable=True)  # Store as string, no foreign key for now
    budget = Column(DECIMAL(15, 2), nullable=True)
    actual_cost = Column(DECIMAL(15, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    manager = relationship("Person", foreign_keys=[manager_id])
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class Task(BaseModel):
    __tablename__ = "tasks"

    project_id = Column(FK_TYPE, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    assignee_id = Column(FK_TYPE, ForeignKey("people.id"), nullable=True)
    reporter_id = Column(FK_TYPE, ForeignKey("people.id"), nullable=True)
    priority = Column(String(20), default="medium")  # low, medium, high, critical
    status = Column(String(50), default="todo")  # backlog, todo, in_progress, blocked, review, done, cancelled
    start_date = Column(Date)
    due_date = Column(Date)
    completed_at = Column(DateTime(timezone=True))
    estimated_hours = Column(DECIMAL(5, 2), nullable=True)
    actual_hours = Column(DECIMAL(5, 2), nullable=True)
    parent_task_id = Column(FK_TYPE, ForeignKey("tasks.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("Person", foreign_keys=[assignee_id])
    reporter = relationship("Person", foreign_keys=[reporter_id])
    parent_task = relationship("Task", remote_side="Task.id", backref="subtasks")