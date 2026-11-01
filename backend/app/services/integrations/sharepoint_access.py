"""Apply SharePoint folder rules to what a viewer is allowed to browse.

The library is read with one app-only identity, so Graph returns every
item regardless of who is asking. These helpers subtract the subtrees the
viewer lacks the permission for before anything reaches the API response.
"""

from __future__ import annotations

from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sql.core.sharepoint_folder_rule import SharePointFolderRule
from app.services.core.permission_service import PermissionService


def normalize_path(path: Optional[str]) -> str:
    parts = [part for part in (path or "").split("/") if part]
    return "/" + "/".join(parts)


def path_is_within(path: Optional[str], folder: str) -> bool:
    path = normalize_path(path).casefold()
    folder = normalize_path(folder).casefold()

    if folder == "/":
        return True

    return path == folder or path.startswith(folder + "/")


def item_is_restricted(
    item: dict,
    restricted_paths: Iterable[str],
    restricted_ids: Iterable[str],
) -> bool:
    """True when the item is covered by a rule the viewer does not meet.

    An item whose location Graph did not report is treated as restricted
    while any rule applies: failing closed is the only safe default when
    the library holds finance and HR data.
    """

    if not restricted_paths and not restricted_ids:
        return False

    item_id = item.get("id")

    if item_id and item_id in restricted_ids:
        return True

    path = item.get("path")

    if not path:
        return True

    return any(
        path_is_within(path, folder)
        for folder in restricted_paths
    )


def filter_visible(
    items: list[dict],
    restricted_paths: Iterable[str],
    restricted_ids: Iterable[str],
) -> list[dict]:
    if not restricted_paths and not restricted_ids:
        return items

    return [
        item
        for item in items
        if not item_is_restricted(item, restricted_paths, restricted_ids)
    ]


async def restricted_locations(
    db: AsyncSession,
    user_id: str,
) -> tuple[set[str], set[str]]:
    """Return the (paths, folder ids) this user must not see."""

    result = await db.execute(select(SharePointFolderRule))
    rules = result.scalars().all()

    if not rules:
        return set(), set()

    granted = set(
        await PermissionService.get_user_permissions(db, str(user_id))
    )

    denied = [
        rule
        for rule in rules
        if rule.required_permission not in granted
    ]

    return (
        {rule.folder_path for rule in denied},
        {rule.folder_id for rule in denied if rule.folder_id},
    )
