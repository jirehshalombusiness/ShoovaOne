"""Microsoft Graph access to the connected SharePoint library.

Files stay in SharePoint. ShoovaOne only reads metadata and links so a
document record can point at the original file; nothing is copied.

Authentication is app-only (client credentials). That means ShoovaOne's
own permissions decide who can browse, not SharePoint's per-file
permissions -- so the app registration should be scoped to a single site
with the Sites.Selected application permission.
"""

from __future__ import annotations

import time
from typing import Any, Optional
from urllib.parse import quote

import httpx

from app.core.config import settings


GRAPH_ROOT = "https://graph.microsoft.com/v1.0"
LOGIN_ROOT = "https://login.microsoftonline.com"
GRAPH_SCOPE = "https://graph.microsoft.com/.default"

ITEM_SELECT = "id,name,size,webUrl,lastModifiedDateTime,folder,file"
MAX_ITEM_ID_LENGTH = 400


class SharePointError(Exception):
    """The connection is configured but Graph could not complete the call."""


class SharePointNotConfigured(SharePointError):
    """Required settings are missing."""


def _graph_error_message(response: httpx.Response) -> str:
    try:
        payload: Any = response.json()
    except ValueError:
        return f"HTTP {response.status_code}"

    error = payload.get("error") if isinstance(payload, dict) else None

    if isinstance(error, dict):
        message = error.get("message") or error.get("code")
        if message:
            return str(message)[:300]

    if isinstance(error, str):
        return error[:300]

    return f"HTTP {response.status_code}"


def _clean_item_id(item_id: str) -> str:
    value = (item_id or "").strip()

    if (
        not value
        or len(value) > MAX_ITEM_ID_LENGTH
        or any(char in value for char in "/\\?#")
    ):
        raise SharePointError("Invalid SharePoint item id")

    return value


def summarize_item(raw: dict) -> dict:
    """Reduce a Graph driveItem to the fields ShoovaOne actually uses."""

    file_meta = raw.get("file") or {}
    folder_meta = raw.get("folder") or {}

    return {
        "id": raw.get("id"),
        "name": raw.get("name"),
        "is_folder": bool(folder_meta),
        "size": raw.get("size"),
        "mime_type": file_meta.get("mimeType"),
        "web_url": raw.get("webUrl"),
        "modified_at": raw.get("lastModifiedDateTime"),
        "child_count": folder_meta.get("childCount"),
    }


class SharePointClient:
    def __init__(self, transport: Optional[httpx.AsyncBaseTransport] = None):
        self._transport = transport
        self._token: Optional[str] = None
        self._token_expires_at = 0.0
        self._site: Optional[dict] = None
        self._drive: Optional[dict] = None

    @property
    def is_configured(self) -> bool:
        return settings.sharepoint_configured

    def _require_configured(self) -> None:
        if self.is_configured:
            return

        missing = ", ".join(settings.sharepoint_missing_settings)
        raise SharePointNotConfigured(
            f"SharePoint is not configured. Missing: {missing}"
        )

    def _new_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            transport=self._transport,
            timeout=30.0,
        )

    async def access_token(self) -> str:
        self._require_configured()

        now = time.monotonic()

        if self._token and now < self._token_expires_at - 60:
            return self._token

        url = (
            f"{LOGIN_ROOT}/{settings.MS_TENANT_ID}"
            "/oauth2/v2.0/token"
        )

        async with self._new_client() as client:
            response = await client.post(
                url,
                data={
                    "client_id": settings.MS_CLIENT_ID,
                    "client_secret": settings.MS_CLIENT_SECRET,
                    "scope": GRAPH_SCOPE,
                    "grant_type": "client_credentials",
                },
            )

        if response.status_code != 200:
            raise SharePointError(
                "Microsoft rejected the app credentials: "
                + _graph_error_message(response)
            )

        payload = response.json()
        token = payload.get("access_token")

        if not token:
            raise SharePointError(
                "Microsoft did not return an access token"
            )

        self._token = token
        self._token_expires_at = now + float(
            payload.get("expires_in", 3600)
        )

        return token

    async def _get(
        self,
        path: str,
        params: Optional[dict] = None,
    ) -> dict:
        token = await self.access_token()

        async with self._new_client() as client:
            response = await client.get(
                f"{GRAPH_ROOT}{path}",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
            )

        if response.status_code >= 400:
            raise SharePointError(
                f"Microsoft Graph returned {response.status_code}: "
                + _graph_error_message(response)
            )

        return response.json()

    async def site(self) -> dict:
        self._require_configured()

        if self._site is None:
            host = settings.SHAREPOINT_HOST.strip()
            path = "/" + settings.SHAREPOINT_SITE_PATH.strip("/")

            self._site = await self._get(
                f"/sites/{host}:{path}",
                params={"$select": "id,displayName,name,webUrl"},
            )

        return self._site

    async def drive(self) -> dict:
        self._require_configured()

        if self._drive is not None:
            return self._drive

        site = await self.site()

        payload = await self._get(
            f"/sites/{site['id']}/drives",
            params={"$select": "id,name,webUrl"},
        )

        drives = payload.get("value", [])
        wanted = (settings.SHAREPOINT_DRIVE or "").strip().lower()

        chosen = next(
            (
                drive
                for drive in drives
                if wanted and (drive.get("name") or "").lower() == wanted
            ),
            None,
        )

        if chosen is None and not wanted and drives:
            chosen = drives[0]

        if chosen is None:
            available = ", ".join(
                drive.get("name") or "?" for drive in drives
            ) or "none"
            raise SharePointError(
                f"SharePoint library '{settings.SHAREPOINT_DRIVE}' "
                f"was not found. Available: {available}"
            )

        self._drive = chosen
        return chosen

    async def list_children(self, folder_id: Optional[str] = None) -> list[dict]:
        item = _clean_item_id(folder_id) if folder_id else "root"
        drive = await self.drive()

        payload = await self._get(
            f"/drives/{drive['id']}/items/{item}/children",
            params={"$select": ITEM_SELECT, "$top": "200"},
        )

        items = [
            summarize_item(raw) for raw in payload.get("value", [])
        ]

        items.sort(key=lambda entry: (
            not entry["is_folder"],
            (entry["name"] or "").lower(),
        ))

        return items

    async def search(self, query: str) -> list[dict]:
        drive = await self.drive()
        term = quote(query.strip(), safe="")

        payload = await self._get(
            f"/drives/{drive['id']}/root/search(q='{term}')",
            params={"$select": ITEM_SELECT, "$top": "100"},
        )

        return [
            summarize_item(raw) for raw in payload.get("value", [])
        ]

    async def get_item(self, item_id: str) -> dict:
        item = _clean_item_id(item_id)
        drive = await self.drive()

        raw = await self._get(
            f"/drives/{drive['id']}/items/{item}",
            params={"$select": ITEM_SELECT},
        )

        return summarize_item(raw)


sharepoint_client = SharePointClient()
