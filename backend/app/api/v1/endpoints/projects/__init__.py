from fastapi import APIRouter

from app.api.v1.endpoints.projects import my_work, projects, tasks

router = APIRouter()

router.include_router(my_work.router, prefix="/my-work", tags=["my_work"])
router.include_router(projects.router, prefix="/projects", tags=["projects"])
router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
