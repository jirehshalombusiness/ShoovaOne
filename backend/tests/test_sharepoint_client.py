"""Checks for the SharePoint Graph client.

Every call is served by an httpx MockTransport, so the tests describe the
Graph contract ShoovaOne depends on without needing a Microsoft 365 tenant.
"""

import json
from urllib.parse import unquote

import httpx
import pytest

from app.core.config import settings
from app.services.integrations import sharepoint as sp


SITE_PATH = "/v1.0/sites/shoova.sharepoint.com:/sites/Portal"
DRIVES_PATH = "/v1.0/sites/site-1/drives"
DRIVE_ROOT = "/v1.0/drives/drive-docs"


@pytest.fixture
def configured_settings(monkeypatch):
    monkeypatch.setattr(settings, "MS_TENANT_ID", "test-tenant", raising=False)
    monkeypatch.setattr(settings, "MS_CLIENT_ID", "test-client", raising=False)
    monkeypatch.setattr(settings, "MS_CLIENT_SECRET", "test-secret", raising=False)
    monkeypatch.setattr(settings, "SHAREPOINT_HOST", "shoova.sharepoint.com", raising=False)
    monkeypatch.setattr(settings, "SHAREPOINT_SITE_PATH", "/sites/Portal", raising=False)
    monkeypatch.setattr(settings, "SHAREPOINT_DRIVE", "Documents", raising=False)


def item(item_id, name, *, folder=False, files=False):
    raw = {"id": item_id, "name": name, "size": 10, "webUrl": f"https://sp/{name}"}

    if folder:
        raw["folder"] = {"childCount": 2}

    if files:
        raw["file"] = {"mimeType": "application/pdf"}

    return raw


class Recorder:
    def __init__(self):
        self.requests = []
        self.uploads = []
        self.existing = set()
        self.folder_conflict = False
        self.children = [
            item("3", "zeta", folder=True),
            item("1", "alpha.pdf", files=True),
            item("2", "Beta", folder=True),
            item("4", "bravo.docx", files=True),
        ]

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        url = request.url

        if url.path.endswith("/oauth2/v2.0/token"):
            return httpx.Response(
                200,
                json={"access_token": "token-1", "expires_in": 3600},
            )

        if url.path == SITE_PATH:
            return httpx.Response(
                200,
                json={
                    "id": "site-1",
                    "displayName": "Shoova Portal",
                    "name": "Portal",
                    "webUrl": "https://shoova.sharepoint.com/sites/Portal",
                },
            )

        if url.path == DRIVES_PATH:
            return httpx.Response(
                200,
                json={
                    "value": [
                        {"id": "drive-shared", "name": "Shared Documents"},
                        {"id": "drive-docs", "name": "Documents"},
                    ]
                },
            )

        if url.path.endswith("/children") and request.method == "POST":
            if self.folder_conflict:
                return httpx.Response(
                    409,
                    json={"error": {"message": "Name already exists"}},
                )
            body = json.loads(request.content)
            return httpx.Response(
                201,
                json={
                    **item("new-folder", body["name"], folder=True),
                    "parentReference": {"path": "/drives/drive-docs/root:"},
                },
            )

        if url.path.endswith("/children"):
            return httpx.Response(200, json={"value": self.children})

        if request.method == "DELETE" and url.path.startswith(f"{DRIVE_ROOT}/items/"):
            return httpx.Response(204)

        if url.path == f"{DRIVE_ROOT}/items/1":
            return httpx.Response(200, json=item("1", "alpha.pdf", files=True))

        if url.path.startswith(f"{DRIVE_ROOT}/root/search("):
            return httpx.Response(
                200,
                json={"value": [item("9", "contract report.pdf", files=True)]},
            )

        if ":/" in url.path:
            if request.method == "PUT" and url.path.endswith(":/content"):
                name = unquote(url.path.rsplit(":/", 2)[-2])
                self.uploads.append(request)
                return httpx.Response(
                    201,
                    json={
                        **item("uploaded-1", name, files=True),
                        "size": len(request.content),
                        "parentReference": {
                            "path": "/drives/drive-docs/root:"
                        },
                    },
                )

            if request.method == "GET":
                name = unquote(url.path.rsplit(":/", 1)[-1])

                if name in self.existing:
                    return httpx.Response(
                        200,
                        json=item("existing", name, files=True),
                    )

        return httpx.Response(
            404,
            json={"error": {"code": "itemNotFound", "message": "Item not found"}},
        )

    def paths(self):
        return [request.url.path for request in self.requests]

    def raw_paths(self):
        return [
            request.url.raw_path.decode().split("?")[0]
            for request in self.requests
        ]


def client_for(recorder):
    return sp.SharePointClient(transport=httpx.MockTransport(recorder))


@pytest.fixture
def recorder():
    return Recorder()


@pytest.fixture
def client(configured_settings, recorder):
    return client_for(recorder)


@pytest.mark.asyncio
async def test_token_is_requested_once_and_reused(client, recorder):
    await client.site()
    await client.drive()

    token_calls = [
        path for path in recorder.paths() if path.endswith("/oauth2/v2.0/token")
    ]
    assert len(token_calls) == 1

    token_request = recorder.requests[0]
    assert token_request.url.path == "/test-tenant/oauth2/v2.0/token"
    body = token_request.read().decode()
    assert "grant_type=client_credentials" in body
    assert "scope=https%3A%2F%2Fgraph.microsoft.com%2F.default" in body


@pytest.mark.asyncio
async def test_site_is_resolved_from_host_and_path(client, recorder):
    site = await client.site()

    assert site["id"] == "site-1"
    site_request = recorder.requests[1]
    assert site_request.url.host == "graph.microsoft.com"
    assert site_request.url.path == SITE_PATH
    assert "displayName" in site_request.url.params["$select"]
    assert site_request.headers["Authorization"] == "Bearer token-1"


@pytest.mark.asyncio
async def test_drive_is_chosen_by_name_not_by_position(client):
    drive = await client.drive()

    assert drive["id"] == "drive-docs"


@pytest.mark.asyncio
async def test_missing_drive_reports_what_is_available(configured_settings, monkeypatch):
    monkeypatch.setattr(settings, "SHAREPOINT_DRIVE", "Contracts", raising=False)
    client = client_for(Recorder())

    with pytest.raises(sp.SharePointError) as error:
        await client.drive()

    message = str(error.value)
    assert "Contracts" in message
    assert "Shared Documents" in message
    assert "Documents" in message


@pytest.mark.asyncio
async def test_children_are_summarised_and_folders_come_first(client):
    items = await client.list_children()

    assert [entry["name"] for entry in items] == [
        "Beta",
        "zeta",
        "alpha.pdf",
        "bravo.docx",
    ]
    assert items[0]["is_folder"] is True
    assert items[2]["is_folder"] is False
    assert items[2]["mime_type"] == "application/pdf"
    assert items[0]["child_count"] == 2


@pytest.mark.asyncio
async def test_folder_id_is_used_in_the_path(client, recorder):
    await client.list_children("folder-9")

    assert f"{DRIVE_ROOT}/items/folder-9/children" in recorder.paths()


@pytest.mark.asyncio
async def test_search_encodes_the_query(client, recorder):
    results = await client.search("contract report")

    assert [entry["id"] for entry in results] == ["9"]
    assert f"{DRIVE_ROOT}/root/search(q='contract%20report')" in recorder.raw_paths()


@pytest.mark.asyncio
async def test_missing_item_surfaces_the_graph_message(client):
    with pytest.raises(sp.SharePointError) as error:
        await client.get_item("999")

    assert "404" in str(error.value)
    assert "Item not found" in str(error.value)


@pytest.mark.asyncio
@pytest.mark.parametrize("bad_id", ["", "   ", "../etc/passwd", "a/b", "x" * 401])
async def test_invalid_item_ids_are_rejected_before_requesting(client, recorder, bad_id):
    recorder.requests.clear()

    with pytest.raises(sp.SharePointError):
        await client.get_item(bad_id)

    assert recorder.requests == []


@pytest.mark.asyncio
async def test_unconfigured_client_names_the_missing_settings(monkeypatch):
    monkeypatch.setattr(settings, "MS_CLIENT_SECRET", "", raising=False)
    client = sp.SharePointClient(transport=httpx.MockTransport(Recorder()))

    with pytest.raises(sp.SharePointNotConfigured) as error:
        await client.site()

    assert "MS_CLIENT_SECRET" in str(error.value)


@pytest.mark.asyncio
async def test_search_is_not_enriched_unless_asked(client, recorder):
    await client.search("contract report")

    item_requests = [
        path
        for path in recorder.paths()
        if path.startswith(f"{DRIVE_ROOT}/items/")
    ]
    assert item_requests == []


@pytest.mark.asyncio
async def test_search_resolves_office_file_path_from_its_parent(configured_settings):
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path

        if path.endswith("/oauth2/v2.0/token"):
            return httpx.Response(
                200,
                json={"access_token": "token-1", "expires_in": 3600},
            )

        if path == SITE_PATH:
            return httpx.Response(200, json={"id": "site-1"})

        if path == DRIVES_PATH:
            return httpx.Response(
                200,
                json={"value": [{"id": "drive-docs", "name": "Documents"}]},
            )

        if path.startswith(f"{DRIVE_ROOT}/root/search("):
            return httpx.Response(
                200,
                json={
                    "value": [
                        {
                            "id": "doc-1",
                            "name": "HRM-System-Proposal.docx",
                            "file": {"mimeType": "application/msword"},
                            "webUrl": (
                                "https://shoova.sharepoint.com/sites/Portal/"
                                "_layouts/15/Doc.aspx?sourcedoc=abc"
                            ),
                            "parentReference": {"id": "folder-hr"},
                        }
                    ]
                },
            )

        if path == f"{DRIVE_ROOT}/items/folder-hr":
            return httpx.Response(
                200,
                json={
                    "id": "folder-hr",
                    "name": "Human Resources",
                    "folder": {"childCount": 3},
                    "webUrl": "https://shoova.sharepoint.com/hr",
                    "parentReference": {
                        "path": f"/drives/drive-docs/root:",
                    },
                },
            )

        return httpx.Response(
            404,
            json={"error": {"message": "Item not found"}},
        )

    client = sp.SharePointClient(transport=httpx.MockTransport(handler))

    results = await client.search("proposal", resolve_paths=True)

    assert results[0]["path"] == (
        "/Human Resources/HRM-System-Proposal.docx"
    )


@pytest.mark.asyncio
async def test_unresolved_search_hit_keeps_an_empty_path(configured_settings):
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path

        if path.endswith("/oauth2/v2.0/token"):
            return httpx.Response(
                200,
                json={"access_token": "token-1", "expires_in": 3600},
            )

        if path == SITE_PATH:
            return httpx.Response(200, json={"id": "site-1"})

        if path == DRIVES_PATH:
            return httpx.Response(
                200,
                json={"value": [{"id": "drive-docs", "name": "Documents"}]},
            )

        if path.startswith(f"{DRIVE_ROOT}/root/search("):
            return httpx.Response(
                200,
                json={
                    "value": [
                        {
                            "id": "doc-1",
                            "name": "orphan.docx",
                            "file": {"mimeType": "application/msword"},
                            "parentReference": {"id": "gone"},
                        }
                    ]
                },
            )

        return httpx.Response(
            404,
            json={"error": {"message": "Item not found"}},
        )

    client = sp.SharePointClient(transport=httpx.MockTransport(handler))

    results = await client.search("orphan", resolve_paths=True)

    assert results[0]["path"] == ""


@pytest.mark.asyncio
async def test_rejected_credentials_are_reported_without_the_secret():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            401,
            json={"error": "invalid_client", "error_description": "AADSTS7000215"},
        )

    client = sp.SharePointClient(transport=httpx.MockTransport(handler))

    with pytest.raises(sp.SharePointError) as error:
        await client.access_token()

    assert "test-secret" not in str(error.value)


@pytest.mark.asyncio
async def test_upload_writes_into_the_current_folder(client, recorder):
    uploaded = await client.upload_file(
        "Q3 report.pdf",
        b"%PDF-1.4 test",
        content_type="application/pdf",
        folder_id="folder-9",
    )

    assert uploaded["name"] == "Q3 report.pdf"
    assert uploaded["path"] == "/Q3 report.pdf"

    put = recorder.uploads[0]
    assert put.url.raw_path.decode() == (
        f"{DRIVE_ROOT}/items/folder-9:/Q3%20report.pdf:/content"
    )
    assert put.headers["Content-Type"] == "application/pdf"
    assert put.content == b"%PDF-1.4 test"


@pytest.mark.asyncio
async def test_upload_without_a_folder_uses_the_library_root(client, recorder):
    await client.upload_file("notes.txt", b"hello", content_type="text/plain")

    assert recorder.uploads[0].url.path == (
        f"{DRIVE_ROOT}/root:/notes.txt:/content"
    )


@pytest.mark.asyncio
async def test_upload_refuses_to_replace_an_existing_file(client, recorder):
    recorder.existing.add("alpha.pdf")

    with pytest.raises(sp.SharePointInvalidInput) as error:
        await client.upload_file("alpha.pdf", b"new content")

    assert "already exists" in str(error.value)
    assert recorder.uploads == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad_name",
    ["", "   ", "../escape.pdf", "a/b.pdf", "a\b.pdf", "bad:name.pdf", "x.exe", "run.PS1", "ends."],
)
async def test_upload_rejects_unsafe_names_before_any_request(
    client, recorder, bad_name
):
    with pytest.raises(sp.SharePointInvalidInput):
        await client.upload_file(bad_name, b"data")

    assert recorder.requests == []


@pytest.mark.asyncio
async def test_upload_rejects_empty_and_oversized_files(client, recorder):
    with pytest.raises(sp.SharePointInvalidInput):
        await client.upload_file("empty.txt", b"")

    with pytest.raises(sp.SharePointInvalidInput):
        await client.upload_file("big.pdf", b"x" * (sp.MAX_UPLOAD_BYTES + 1))

    assert recorder.requests == []


@pytest.mark.asyncio
async def test_create_folder_posts_non_conflicting_folder(client, recorder):
    folder = await client.create_folder("Policies", parent_id="folder-9")

    assert folder["id"] == "new-folder"
    assert folder["name"] == "Policies"
    create = next(request for request in recorder.requests if request.method == "POST" and request.url.path.endswith("/children"))
    assert create.url.path == f"{DRIVE_ROOT}/items/folder-9/children"
    assert json.loads(create.content) == {
        "name": "Policies",
        "folder": {},
        "@microsoft.graph.conflictBehavior": "fail",
    }


@pytest.mark.asyncio
async def test_create_folder_maps_graph_name_conflict(client, recorder):
    recorder.folder_conflict = True

    with pytest.raises(sp.SharePointConflict, match="already exists"):
        await client.create_folder("Policies")


@pytest.mark.asyncio
@pytest.mark.parametrize("bad_name", ["", " ", "../escape", "bad/name", "bad#name"])
async def test_create_folder_rejects_unsafe_names_before_graph(client, recorder, bad_name):
    with pytest.raises(sp.SharePointInvalidInput):
        await client.create_folder(bad_name)

    assert recorder.requests == []


@pytest.mark.asyncio
async def test_delete_folder_calls_graph_delete(client, recorder):
    await client.delete_folder("folder-9")

    request = next(request for request in recorder.requests if request.method == "DELETE")
    assert request.url.path == f"{DRIVE_ROOT}/items/folder-9"
