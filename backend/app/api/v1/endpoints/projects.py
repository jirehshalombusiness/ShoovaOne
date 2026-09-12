from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from datetime import date
from typing import List, Optional
import uuid

from app.models.sql.timesheet import Timesheet, TimesheetEntry, TimesheetApprovalHistory
from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.project import Project, ProjectMember, Milestone, Task
from app.models.sql.user import Person
from app.models.pydantic.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    MilestoneCreate, MilestoneUpdate, MilestoneResponse,
    ProjectMemberCreate, ProjectMemberResponse,TaskCreate, TaskUpdate, TaskResponse

)

router = APIRouter()


# ============================================
# LIST + DETAIL
# ============================================

@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    manager_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PROJECTS_VIEW)),
):
    """List projects with counts."""
    query = select(Project).options(selectinload(Project.manager))

    if status:
        query = query.where(Project.status == status)
    if priority:
        query = query.where(Project.priority == priority)
    if manager_id:
        query = query.where(Project.manager_id == manager_id)
    if search:
        query = query.where(
            or_(
                Project.name.ilike(f"%{search}%"),
                Project.code.ilike(f"%{search}%"),
                Project.description.ilike(f"%{search}%"),
            )
        )

    query = query.offset(skip).limit(limit).order_by(Project.created_at.desc())
    result = await db.execute(query)
    projects = result.scalars().all()

    # Build response with counts
    responses: List[ProjectResponse] = []
    for p in projects:
        # Count tasks
        task_count_result = await db.execute(
            select(func.count(Task.id)).where(Task.project_id == p.id)
        )
        task_count = task_count_result.scalar() or 0

        completed_result = await db.execute(
            select(func.count(Task.id)).where(
                Task.project_id == p.id,
                Task.status == "done",
            )
        )
        completed_count = completed_result.scalar() or 0

        # Member count
        member_count_result = await db.execute(
            select(func.count(ProjectMember.id)).where(ProjectMember.project_id == p.id)
        )
        member_count = member_count_result.scalar() or 0

        responses.append(
            ProjectResponse(
                id=str(p.id),
                name=p.name,
                code=p.code,
                description=p.description,
                status=p.status,
                priority=p.priority,
                start_date=p.start_date,
                end_date=p.end_date,
                manager_id=str(p.manager_id) if p.manager_id else None,
                department_id=p.department_id,
                programme_id=getattr(p, "programme_id", None),
                organisation_id=getattr(p, "organisation_id", None),
                budget=p.budget,
                actual_cost=p.actual_cost,
                progress=getattr(p, "progress", 0) or 0,
                created_at=p.created_at,
                updated_at=p.updated_at,
                manager_first_name=p.manager.first_name if p.manager else None,
                manager_last_name=p.manager.last_name if p.manager else None,
                manager_image_url=p.manager.profile_image_url if p.manager else None,
                task_count=task_count,
                completed_task_count=completed_count,
                member_count=member_count,
            )
        )

    return responses


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PROJECTS_VIEW)),
):
    """Get one project with members + milestones."""
    result = await db.execute(
        select(Project)
        .options(
            selectinload(Project.manager),
            selectinload(Project.members).selectinload(ProjectMember.person),
            selectinload(Project.milestones),
        )
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Members with person data
    members_result = await db.execute(
        select(ProjectMember)
        .options(selectinload(ProjectMember.person))
        .where(ProjectMember.project_id == project_id)
    )
    members = members_result.scalars().all()

    # Milestones
    milestones_result = await db.execute(
        select(Milestone)
        .where(Milestone.project_id == project_id)
        .order_by(Milestone.position)
    )
    milestones = milestones_result.scalars().all()

    # Task counts
    task_count_result = await db.execute(
        select(func.count(Task.id)).where(Task.project_id == project.id)
    )
    task_count = task_count_result.scalar() or 0

    completed_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id == project.id, Task.status == "done"
        )
    )
    completed_count = completed_result.scalar() or 0

    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        code=project.code,
        description=project.description,
        status=project.status,
        priority=project.priority,
        start_date=project.start_date,
        end_date=project.end_date,
        manager_id=str(project.manager_id) if project.manager_id else None,
        department_id=project.department_id,
        programme_id=getattr(project, "programme_id", None),
        organisation_id=getattr(project, "organisation_id", None),
        budget=project.budget,
        actual_cost=project.actual_cost,
        progress=getattr(project, "progress", 0) or 0,
        created_at=project.created_at,
        updated_at=project.updated_at,
        manager_first_name=project.manager.first_name if project.manager else None,
        manager_last_name=project.manager.last_name if project.manager else None,
        manager_image_url=project.manager.profile_image_url if project.manager else None,
        task_count=task_count,
        completed_task_count=completed_count,
        member_count=len(members),
        members=[
            ProjectMemberResponse(
                id=str(m.id),
                project_id=str(m.project_id),
                person_id=str(m.person_id),
                role=m.role,
                joined_at=m.joined_at,
                first_name=m.person.first_name if m.person else None,
                last_name=m.person.last_name if m.person else None,
                profile_image_url=m.person.profile_image_url if m.person else None,
            )
            for m in members
        ],
        milestones=[
            MilestoneResponse(
                id=str(ms.id),
                project_id=str(ms.project_id),
                title=ms.title,
                description=ms.description,
                due_date=ms.due_date,
                completed_at=ms.completed_at,
                status=ms.status,
                position=ms.position,
            )
            for ms in milestones
        ],
    )


# ============================================
# CREATE / UPDATE / DELETE
# ============================================

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PROJECTS_CREATE)),
):
    """Create a project."""
    project = Project(
        id=str(uuid.uuid4()),
        **payload.model_dump(
            exclude={"programme_id", "organisation_id", "progress"}
        ),
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    # Auto-add manager as a member
    if project.manager_id:
        member = ProjectMember(
            id=str(uuid.uuid4()),
            project_id=project.id,
            person_id=project.manager_id,
            role="manager",
        )
        db.add(member)
        await db.commit()

    return await get_project(project.id, db, current_user)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PROJECTS_EDIT)),
):
    """Update a project."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for key, value in payload.model_dump(
        exclude_unset=True,
        exclude={"programme_id", "organisation_id"},
    ).items():
        setattr(project, key, value)

    await db.commit()
    return await get_project(project_id, db, current_user)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PROJECTS_DELETE)),
):
    """Delete a project."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)
    await db.commit()


# ============================================
# MILESTONES
# ============================================

@router.post("/{project_id}/milestones", response_model=MilestoneResponse)
async def create_milestone(
    project_id: str,
    payload: MilestoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PROJECTS_EDIT)),
):
    """Add a milestone."""
    milestone = Milestone(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        status=payload.status,
        position=payload.position,
    )
    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)
    return MilestoneResponse(
        id=str(milestone.id),
        project_id=str(milestone.project_id),
        title=milestone.title,
        description=milestone.description,
        due_date=milestone.due_date,
        completed_at=milestone.completed_at,
        status=milestone.status,
        position=milestone.position,
    )


@router.put("/milestones/{milestone_id}", response_model=MilestoneResponse)
async def update_milestone(
    milestone_id: str,
    payload: MilestoneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PROJECTS_EDIT)),
):
    """Update a milestone."""
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    ms = result.scalar_one_or_none()
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(ms, key, value)

    await db.commit()
    await db.refresh(ms)
    return MilestoneResponse(
        id=str(ms.id),
        project_id=str(ms.project_id),
        title=ms.title,
        description=ms.description,
        due_date=ms.due_date,
        completed_at=ms.completed_at,
        status=ms.status,
        position=ms.position,
    )


@router.delete("/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_milestone(
    milestone_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PROJECTS_EDIT)),
):
    """Delete a milestone."""
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    ms = result.scalar_one_or_none()
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone not found")

    await db.delete(ms)
    await db.commit()


# ============================================
# MEMBERS
# ============================================

@router.post("/{project_id}/members", response_model=ProjectMemberResponse)
async def add_member(
    project_id: str,
    payload: ProjectMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PROJECTS_EDIT)),
):
    """Add a member to a project."""
    # Check if member exists
    existing = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.person_id == payload.person_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Person is already a member")

    member = ProjectMember(
        id=str(uuid.uuid4()),
        project_id=project_id,
        person_id=payload.person_id,
        role=payload.role,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    # Get person data
    person_result = await db.execute(
        select(Person).where(Person.id == payload.person_id)
    )
    person = person_result.scalar_one_or_none()

    return ProjectMemberResponse(
        id=str(member.id),
        project_id=str(member.project_id),
        person_id=str(member.person_id),
        role=member.role,
        joined_at=member.joined_at,
        first_name=person.first_name if person else None,
        last_name=person.last_name if person else None,
        profile_image_url=person.profile_image_url if person else None,
    )


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PROJECTS_EDIT)),
):
    """Remove a member from a project."""
    result = await db.execute(select(ProjectMember).where(ProjectMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.delete(member)
    await db.commit()

# Add these endpoints at the bottom of the file:

@router.get("/{project_id}/stats")
async def get_project_stats(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PROJECTS_VIEW)),
):
    """Aggregated stats for a project."""
    # Task stats
    total_result = await db.execute(
        select(func.count(Task.id)).where(Task.project_id == project_id)
    )
    total_tasks = total_result.scalar() or 0

    completed_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id == project_id, Task.status == "done"
        )
    )
    completed_tasks = completed_result.scalar() or 0

    in_progress_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id == project_id, Task.status == "in_progress"
        )
    )
    in_progress_tasks = in_progress_result.scalar() or 0

    overdue_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id == project_id,
            Task.status.notin_(["done", "cancelled"]),
            Task.due_date < date.today(),
        )
    )
    overdue_tasks = overdue_result.scalar() or 0

    # Member count
    member_result = await db.execute(
        select(func.count(ProjectMember.id)).where(
            ProjectMember.project_id == project_id
        )
    )
    member_count = member_result.scalar() or 0

    # Milestone stats
    milestone_total = await db.execute(
        select(func.count(Milestone.id)).where(Milestone.project_id == project_id)
    )
    total_milestones = milestone_total.scalar() or 0

    milestone_done = await db.execute(
        select(func.count(Milestone.id)).where(
            Milestone.project_id == project_id, Milestone.status == "completed"
        )
    )
    completed_milestones = milestone_done.scalar() or 0

    # Total hours logged
    hours_result = await db.execute(
        select(func.sum(TimesheetEntry.duration))
        .join(Timesheet, TimesheetEntry.timesheet_id == Timesheet.id)
        .where(TimesheetEntry.project_id == project_id)
    )
    total_hours = float(hours_result.scalar() or 0)

    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "in_progress_tasks": in_progress_tasks,
        "overdue_tasks": overdue_tasks,
        "member_count": member_count,
        "total_milestones": total_milestones,
        "completed_milestones": completed_milestones,
        "total_hours": total_hours,
    }

@router.get("/{project_id}/tasks", response_model=List[TaskResponse])
async def get_project_tasks(
    project_id: str,
    status_filter: Optional[str] = Query(None, alias="status"),
    assignee_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TASKS_VIEW)),
):
    """Get tasks for a project."""
    query = select(Task).where(Task.project_id == project_id)

    if status_filter:
        query = query.where(Task.status == status_filter)
    if assignee_id:
        query = query.where(Task.assignee_id == assignee_id)

    query = query.order_by(Task.created_at.desc())
    result = await db.execute(query)
    tasks = result.scalars().all()

    return [
        TaskResponse(
            id=str(t.id),
            project_id=str(t.project_id) if t.project_id else None,
            title=t.title,
            description=t.description,
            status=t.status,
            priority=t.priority,
            assignee_id=str(t.assignee_id) if t.assignee_id else None,
            assignee_first_name=t.assignee.first_name if t.assignee else None,
            assignee_last_name=t.assignee.last_name if t.assignee else None,
            assignee_image_url=t.assignee.profile_image_url if t.assignee else None,
            reporter_id=str(t.reporter_id) if t.reporter_id else None,
            due_date=t.due_date,
            start_date=t.start_date,
            completed_at=t.completed_at,
            estimated_hours=float(t.estimated_hours) if t.estimated_hours else None,
            actual_hours=float(t.actual_hours) if t.actual_hours else None,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in tasks
    ]


@router.post("/{project_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: str,
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TASKS_CREATE)),
):
    """Create a task."""
    task = Task(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=payload.title,
        description=payload.description,
        status=payload.status or "todo",
        priority=payload.priority or "medium",
        assignee_id=payload.assignee_id,
        reporter_id=current_user.person_id,
        due_date=payload.due_date,
        start_date=payload.start_date,
        estimated_hours=payload.estimated_hours,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # Reload with assignee
    result = await db.execute(select(Task).where(Task.id == task.id))
    task = result.scalar_one()

    return TaskResponse(
        id=str(task.id),
        project_id=str(task.project_id) if task.project_id else None,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        assignee_id=str(task.assignee_id) if task.assignee_id else None,
        assignee_first_name=task.assignee.first_name if task.assignee else None,
        assignee_last_name=task.assignee.last_name if task.assignee else None,
        assignee_image_url=task.assignee.profile_image_url if task.assignee else None,
        reporter_id=str(task.reporter_id) if task.reporter_id else None,
        due_date=task.due_date,
        start_date=task.start_date,
        completed_at=task.completed_at,
        estimated_hours=float(task.estimated_hours) if task.estimated_hours else None,
        actual_hours=float(task.actual_hours) if task.actual_hours else None,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TASKS_EDIT)),
):
    """Update a task."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = payload.model_dump(exclude_unset=True)

    # Handle status change to "done"
    if "status" in update_data and update_data["status"] == "done" and task.status != "done":
        from datetime import datetime, timezone
        task.completed_at = datetime.now(timezone.utc)

    for key, value in update_data.items():
        setattr(task, key, value)

    await db.commit()
    await db.refresh(task)

    # Reload with assignee
    result = await db.execute(select(Task).where(Task.id == task.id))
    task = result.scalar_one()

    return TaskResponse(
        id=str(task.id),
        project_id=str(task.project_id) if task.project_id else None,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        assignee_id=str(task.assignee_id) if task.assignee_id else None,
        assignee_first_name=task.assignee.first_name if task.assignee else None,
        assignee_last_name=task.assignee.last_name if task.assignee else None,
        assignee_image_url=task.assignee.profile_image_url if task.assignee else None,
        reporter_id=str(task.reporter_id) if task.reporter_id else None,
        due_date=task.due_date,
        start_date=task.start_date,
        completed_at=task.completed_at,
        estimated_hours=float(task.estimated_hours) if task.estimated_hours else None,
        actual_hours=float(task.actual_hours) if task.actual_hours else None,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TASKS_DELETE)),
):
    """Delete a task."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()