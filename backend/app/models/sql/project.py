from sqlalchemy import Column, String, DateTime, ForeignKey, Date, Text, DECIMAL
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel, GUID


class Project(BaseModel):
    __tablename__ = "projects"

    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True)
    description = Column(Text)
    status = Column(String(50), default="planning")
    start_date = Column(Date)
    end_date = Column(Date)
    priority = Column(String(20), default="medium")
    manager_id = Column(GUID, ForeignKey("people.id"), nullable=True)
    department_id = Column(GUID, nullable=True)
    budget = Column(DECIMAL(15, 2), nullable=True)
    actual_cost = Column(DECIMAL(15, 2), nullable=True)

    # Relationships
    manager = relationship("Person", foreign_keys=[manager_id])
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class Task(BaseModel):
    __tablename__ = "tasks"

    project_id = Column(GUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    assignee_id = Column(GUID, ForeignKey("people.id"), nullable=True)
    reporter_id = Column(GUID, ForeignKey("people.id"), nullable=True)
    priority = Column(String(20), default="medium")
    status = Column(String(50), default="todo")
    start_date = Column(Date)
    due_date = Column(Date)
    completed_at = Column(DateTime(timezone=True))
    estimated_hours = Column(DECIMAL(5, 2), nullable=True)
    actual_hours = Column(DECIMAL(5, 2), nullable=True)
    parent_task_id = Column(GUID, ForeignKey("tasks.id"), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("Person", foreign_keys=[assignee_id])
    reporter = relationship("Person", foreign_keys=[reporter_id])
    parent_task = relationship("Task", remote_side="Task.id", backref="subtasks")