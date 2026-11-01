"""Checks for the upload endpoint's own rules.

The Graph client is covered by ``test_sharepoint_client``; these tests make
sure the route refuses bad targets before anything is written.
"""

from io import BytesIO

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

from app.api.v1.endpoints.integrations import sharepoint as endpoint


class FakeUser:
    id = "user-1"


class FakeClient:
    def __init__(self, folder=None, item=None):
        self.folder = folder
        self.item = item
        self.uploads = []

    async def get_item(self, item_id):
        return self.folder

    async def upload_file(self, **kwargs):
        self.uploads.append(kwargs)
        return self.item


def upload_file(name="report.pdf", content=b"%PDF-1.4"):
    return UploadFile(
        file=BytesIO(content),
        filename=name,
        headers=Headers({"content-type": "application/pdf"}),
    )


def patch(monkeypatch, *, denied_paths=(), denied_ids=(), client):
    async def restricted_locations(_db, _user_id):
        return set(denied_paths), set(denied_ids)

    monkeypatch.setattr(endpoint, "restricted_locations", restricted_locations)
    monkeypatch.setattr(endpoint, "sharepoint_client", client)


@pytest.mark.asyncio
async def test_upload_into_a_restricted_folder_is_refused(monkeypatch):
    client = FakeClient(
        folder={"id": "f1", "name": "Finance", "path": "/Finance", "is_folder": True},
        item={"id": "x", "name": "report.pdf"},
    )
    patch(monkeypatch, denied_paths={"/Finance"}, client=client)

    with pytest.raises(HTTPException) as exc:
        await endpoint.upload_sharepoint_item(
            file=upload_file(),
            folder_id="f1",
            current_user=FakeUser(),
            db=None,
        )

    assert exc.value.status_code == 403
    assert client.uploads == []


@pytest.mark.asyncio
async def test_upload_into_a_file_is_refused(monkeypatch):
    client = FakeClient(
        folder={"id": "f1", "name": "report.pdf", "path": "/report.pdf", "is_folder": False},
        item={"id": "x", "name": "report.pdf"},
    )
    patch(monkeypatch, client=client)

    with pytest.raises(HTTPException) as exc:
        await endpoint.upload_sharepoint_item(
            file=upload_file(),
            folder_id="f1",
            current_user=FakeUser(),
            db=None,
        )

    assert exc.value.status_code == 400
    assert client.uploads == []


@pytest.mark.asyncio
async def test_upload_into_an_allowed_folder_passes_content_through(monkeypatch):
    client = FakeClient(
        folder={"id": "f1", "name": "Policies", "path": "/Policies", "is_folder": True},
        item={"id": "new", "name": "report.pdf", "path": ""},
    )
    patch(monkeypatch, denied_paths={"/Finance"}, client=client)

    item = await endpoint.upload_sharepoint_item(
        file=upload_file(),
        folder_id="f1",
        current_user=FakeUser(),
        db=None,
    )

    assert client.uploads == [
        {
            "filename": "report.pdf",
            "content": b"%PDF-1.4",
            "content_type": "application/pdf",
            "folder_id": "f1",
        }
    ]
    # Graph omitted the path on the write response; the endpoint fills it in
    # from the folder so folder rules still match the new file.
    assert item["path"] == "/Policies/report.pdf"


@pytest.mark.asyncio
async def test_upload_to_the_root_does_not_look_up_a_folder(monkeypatch):
    client = FakeClient(
        folder=None,
        item={"id": "new", "name": "notes.txt", "path": "/notes.txt"},
    )
    patch(monkeypatch, client=client)

    item = await endpoint.upload_sharepoint_item(
        file=upload_file("notes.txt", b"hello"),
        folder_id=None,
        current_user=FakeUser(),
        db=None,
    )

    assert item["path"] == "/notes.txt"
    assert client.uploads[0]["folder_id"] is None
