"""Browse the connected SharePoint library.

Documents stay in SharePoint; these endpoints return metadata and links
so the documents module can reference a file without copying it.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import settings
from app.core.security import Permissions, require_permission
from app.models.sql.core.user import User
from app.services.integrations.sharepoint import (
    SharePointError,
    SharePointNotConfigured,
    sharepoint_client,
)


router = APIRouter(prefix="/sharepoint", tags=["sharepoint"])


@router.get("/status")
async def sharepoint_status(
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_VIEW)
    ),
):
    """Report whether the connection is configured and actually works."""

    if not sharepoint_client.is_configured:
        return {
            "configured": False,
            "reachable": False,
            "missing_settings": settings.sharepoint_missing_settings,
        }

    try:
        site = await sharepoint_client.site()
        drive = await sharepoint_client.drive()
    except SharePointNotConfigured as exc:
        return {
            "configured": False,
            "reachable": False,
            "missing_settings": settings.sharepoint_missing_settings,
            "error": str(exc),
        }
    except SharePointError as exc:
        return {
            "configured": True,
            "reachable": False,
            "missing_settings": [],
            "error": str(exc),
        }

    return {
        "configured": True,
        "reachable": True,
        "missing_settings": [],
        "site": {
            "id": site.get("id"),
            "name": site.get("displayName") or site.get("name"),
            "web_url": site.get("webUrl"),
        },
        "drive": {
            "id": drive.get("id"),
            "name": drive.get("name"),
            "web_url": drive.get("webUrl"),
        },
    }


@router.get("/items")
async def list_sharepoint_items(
    folder_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None, min_length=2, max_length=200),
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_VIEW)
    ),
):
    """List a folder, or search the connected library."""

    try:
        if q:
            items = await sharepoint_client.search(q)
        else:
            items = await sharepoint_client.list_children(folder_id)
    except SharePointNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except SharePointError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    return {
        "folder_id": folder_id or "root",
        "query": q,
        "items": items,
    }


@router.get("/items/{item_id}")
async def get_sharepoint_item(
    item_id: str,
    current_user: User = Depends(
        require_permission(Permissions.DOCUMENTS_VIEW)
    ),
):
    """Fetch one file or folder's metadata and web link."""

    try:
        item = await sharepoint_client.get_item(item_id)
    except SharePointNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except SharePointError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    return item
