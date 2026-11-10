# SharePoint integration

ShoovaOne connects to the organisation's SharePoint library so contracts,
policies and programme files can be browsed — and uploaded — from inside
the platform. Files are **not copied**. ShoovaOne asks Microsoft Graph for
the folder listing and gets back a `webUrl` that opens the original file in
SharePoint; an upload writes the file straight into the library.

The connection is app-only (client credentials): ShoovaOne signs in as
itself, not as whichever person is browsing.

---

## 1. Current state

| Item | Status |
| --- | --- |
| Graph client (token, site, drive, listing, search, upload) | Built and tested |
| API endpoints `/api/v1/integrations/sharepoint/*` | Built, behind Shoova permissions and the CEO role for folder operations |
| Settings in `backend/.env` | Present locally |
| Azure application permission | `Sites.Selected` site grant is **read**, but tenant-wide `Sites.*` roles are still granted and allow writes |
| Settings on Render (production) | Configured — connection verified live on 2026-11-01 |
| Documents browse / search / upload UI | Built at `/documents` (2026-11-01) |
| Folder access rules | Built — `/Finance` and `/Human Resources` restricted by permission |
| Naming guidance | Optional upload-time suggestion; original filenames remain allowed |
| Folder governance | CEO-only direct create/delete; other users request CEO approval in ShoovaOne |

Production check on 2026-11-01 returned `configured: true, reachable: true` for
`Shoova Initiative Portal` / `Documents`, listed the 7 root folders, read a
nested file's metadata, found it by search, **uploaded a probe file to the
library root and deleted it again**. The site-level grant still reports
`roles: ["read"]`; the write succeeded because the app registration also holds
broader `Sites.*` application permissions, which take precedence. If those
broad permissions are removed later (recommended), the site grant must be
changed to `Write` before uploads will work again.

If the connection ever reports `Microsoft Graph returned 401: General
exception while processing`, check the app's application permissions. An
app-only token with `roles: None` has no application permissions at all —
delegated `User.Read` does not help here.

---

## 2. Fix the permission in Azure

You need Global Administrator or Privileged Role Administrator, plus
SharePoint Administrator for the site grant in Option A.

Go to **Azure Portal → Microsoft Entra ID → App registrations → ShoovaOne
(app id `0cee5507-8d74-48e6-80de-eb2b75a55d0f`, tenant
`0a6848ac-f8ff-43ea-bb02-1955e6bf6de7`)**.

### Option A — `Sites.Selected` (recommended)

Least privilege: the app can only reach sites that are explicitly granted
to it, with the roles it was granted there.

1. **API permissions → Add a permission → Microsoft Graph → Application
   permissions → Sites → `Sites.Selected`**.
2. Click **Grant admin consent for Shoova Initiative**.
3. Grant the app read access to this one site. From a machine with the
   PnP PowerShell module and a SharePoint Administrator account:

   ```powershell
   Connect-PnPOnline -Url "https://shoovainitiative1.sharepoint.com/sites/ShoovaInitiativePortal" -Interactive
   Grant-PnPAzureADAppSitePermission `
     -AppId "0cee5507-8d74-48e6-80de-eb2b75a55d0f" `
     -DisplayName "ShoovaOne" `
     -Permissions Read `
     -Site "https://shoovainitiative1.sharepoint.com/sites/ShoovaInitiativePortal"
   ```

   `-Permissions Read` allows listing and metadata only. Uploads need
   `-Permissions Write`, and `Read` + `Write` are granted separately, so a
   site that was granted `Read` must be granted `Write` as well before the
   page can upload once the broad `Sites.*` permissions are removed.

   To upgrade an existing grant, list the site's permissions and grant the
   new role:

   ```powershell
   Get-PnPAzureADAppSitePermission -Site "https://shoovainitiative1.sharepoint.com/sites/ShoovaInitiativePortal"
   Grant-PnPAzureADAppSitePermission `
     -AppId "0cee5507-8d74-48e6-80de-eb2b75a55d0f" `
     -DisplayName "ShoovaOne" `
     -Permissions Write `
     -Site "https://shoovainitiative1.sharepoint.com/sites/ShoovaInitiativePortal"
   ```

   Re-running the grant with `-Permissions Read,Write` replaces the roles on
   the existing grant.

### Option B — `Sites.Read.All` (faster, broader)

1. **API permissions → Add a permission → Microsoft Graph → Application
   permissions → Sites → `Sites.Read.All`**.
2. **Grant admin consent**.

No per-site grant is needed, but the app can then read **every** site in
the tenant. Choose this only if that is acceptable, or as a temporary
step while Option A is set up. Option A can replace it later by removing
`Sites.Read.All` after the site grant works.

> Delegated permissions do not work here. The app has no signed-in
> SharePoint user, so anything under "Delegated permissions" is ignored.
>
> **Do not leave the whole `Sites.*` set granted.** `Sites.Selected` only
> restricts the app when it is the sole site permission. If
> `Sites.Read.All`, `Sites.ReadWrite.All`, `Sites.FullControl.All` or
> `Sites.Manage.All` is also granted, the app can reach every site in the
> tenant and `Sites.Selected` does nothing. Those broad permissions are
> only useful as a temporary bridge to create the one site grant, then
> must be removed.

---

## 3. Settings

Six settings, read from `backend/.env` locally and from Render environment
variables in production:

| Variable | Example / meaning |
| --- | --- |
| `MS_TENANT_ID` | Directory (tenant) id — not secret |
| `MS_CLIENT_ID` | Application (client) id — not secret |
| `MS_CLIENT_SECRET` | **Secret.** Never commit, never print, never paste in chat |
| `SHAREPOINT_HOST` | `shoovainitiative1.sharepoint.com` |
| `SHAREPOINT_SITE_PATH` | `/sites/ShoovaInitiativePortal` |
| `SHAREPOINT_DRIVE` | `Documents` (the library name shown in SharePoint) |

`SHAREPOINT_DRIVE` is the **library name**, not the URL. If it is left
empty the first library is used. If the name does not match, the error
lists the libraries that do exist.

On Render: **Service → Environment → Add Environment Variable** for each
of the six names, then save. The service redeploys automatically. The
client secret is the one from **Certificates & secrets → Value** — copy
it when created, because Azure only shows it once. If it has expired,
create a new secret and update the Render value.

Rotating the secret: create new secret in Azure → update Render → wait
for redeploy → delete the old secret. The backend caches tokens for up
to an hour, so a redeploy is the clean way to drop the old one.

---

## 4. Verify the connection

Sign in as a user with `documents.view` and call:

```
GET /api/v1/integrations/sharepoint/status
```

Expected when healthy:

```json
{
  "configured": true,
  "reachable": true,
  "missing_settings": [],
  "site":  { "id": "...", "name": "Shoova Initiative Portal", "web_url": "https://..." },
  "drive": { "id": "...", "name": "Documents", "web_url": "https://..." }
}
```

This endpoint never throws. A failure is reported in the body:

| Body | Meaning |
| --- | --- |
| `"configured": false` + `missing_settings` | One or more env vars absent or empty |
| `"reachable": false` + `"401 ... General exception"` | No application permission, or consent not granted |
| `"reachable": false` + `"403 ... access denied"` | `Sites.Selected` granted but this site not granted to the app |
| `"reachable": false` + `"library 'X' was not found"` | `SHAREPOINT_DRIVE` does not match; body lists real names |

---

## 5. Endpoints

Browsing endpoints require `documents.view`; upload requires
`documents.upload`; the rules endpoints require `documents.manage`.
Direct folder creation/deletion and request decisions require the exact
`ceo` role. Other users with `documents.view` can submit requests and see
their own request history.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/integrations/sharepoint/status` | Configuration + live reachability |
| GET | `/api/v1/integrations/sharepoint/items?folder_id=&q=` | List a folder, or search |
| GET | `/api/v1/integrations/sharepoint/items/{item_id}` | One file/folder's metadata |
| POST | `/api/v1/integrations/sharepoint/items/upload` | Upload one file (`file`, optional `folder_id`) |
| POST | `/api/v1/integrations/sharepoint/items/folders` | CEO creates a folder (`name`, optional `parent_folder_id`) |
| DELETE | `/api/v1/integrations/sharepoint/items/folders/{folder_id}` | CEO deletes an empty folder |
| POST | `/api/v1/integrations/sharepoint/folder-requests` | Submit a create/delete request with a reason |
| GET | `/api/v1/integrations/sharepoint/folder-requests` | CEO approval queue |
| GET | `/api/v1/integrations/sharepoint/folder-requests/mine` | Current user's request history |
| POST | `/api/v1/integrations/sharepoint/folder-requests/{request_id}/decision` | CEO approves or declines; approval performs the operation |
| GET | `/api/v1/integrations/sharepoint/rules` | Every folder restriction |
| POST | `/api/v1/integrations/sharepoint/rules` | Restrict a folder (`folder_id`, `required_permission`) |
| DELETE | `/api/v1/integrations/sharepoint/rules/{rule_id}` | Remove a restriction |

`folder_id` may be omitted for the library root. `q` searches the whole
library and must be 2–200 characters; when `q` is set, `folder_id` is
ignored. Each item looks like:

```json
{
  "id": "...",
  "name": "Contract - Acme 2026.pdf",
  "path": "/Partnerships & Donors/Contracts/Contract - Acme 2026.pdf",
  "is_folder": false,
  "size": 481233,
  "mime_type": "application/pdf",
  "web_url": "https://shoovainitiative1.sharepoint.com/...",
  "modified_at": "2026-10-30T14:02:11Z",
  "child_count": null
}
```

Folders are returned first, then files, each alphabetically. `path` is
drive-relative and is what the rules match against; it is empty only when
Graph cannot say where an item lives.

Restricted content is removed server-side: a restricted folder is absent
from its parent's listing, search hits inside it are dropped, and a direct
`GET /items/{id}` for it returns `404`. `POST /rules` takes a folder id and
resolves the path from Graph itself, so the caller cannot claim a path.

### Uploading

`POST /items/upload` is a `multipart/form-data` request with one `file` part
and an optional `folder_id` form field (omit it for the library root). It
returns `201` and the same item shape as `GET /items/{id}`.

Rules the server enforces before Graph is called:

| Rule | Result |
| --- | --- |
| No `documents.upload` permission | `403` |
| Uploading into a folder covered by a folder rule the caller cannot satisfy | `403` |
| `folder_id` points at a file | `400` |
| Empty file | `400` |
| Larger than 25 MB | `413` |
| Name longer than 255 characters, or containing `\ / : * ? " < > \|` or control characters | `400` |
| Executable/script extension (`.exe`, `.bat`, `.cmd`, `.ps1`, `.js`, `.vbs`, `.msi`, …) | `400` |
| A file with the same name already exists in the target folder | `400` — uploads never overwrite |

The Graph write is a simple `PUT .../content` (25 MB ceiling), not a
resumable session, so there is one request per file and no partial state to
clean up. The frontend picks the file, shows `Uploading…` until the response
and refreshes the folder listing on success.

Before upload, the naming guide suggests
`Entity_Function_DocumentType_Subject_YYYY-MM-DD_Version_Status.ext`.
Entity options are `SHARED`, `US` and `GH`; status options are Draft,
Review, Approved and Archived. Users can edit the suggestion or keep the
original name. Naming is guidance only and does not block uploads.

### Folder requests and CEO approval

Folder requests are stored in `sharepoint_folder_requests`. A request
records the operation, target path, requester, reason and decision history.
Active CEOs receive an in-app notification linking to the approval queue.
Approval performs the requested operation in SharePoint; declining only
updates the request. The requester receives an in-app notification after
the decision. Delete operations re-check that the target is still empty at
execution time; the library root and non-empty folders cannot be deleted.

The database migration is
`database/migrations/020_sharepoint_folder_requests.sql`. The current
Render build invokes `backend/migrate_postgres.py`, which does not
automatically apply numbered SQL files. Apply migration 020 once to the
production Supabase database using the SQL editor before deploying the
folder-request feature; it is safe to re-run.

Errors otherwise match browsing: `503` when the integration is not
configured, `502` when Graph rejects or fails the call, `403` when the user
lacks the required permission, `404` for restricted items.

Paging is fixed at 200 items per folder and 100 search results. Nothing
follows `@odata.nextLink` yet — a folder with more than 200 direct
children shows the first 200.

---

## 6. Security model — read this before going live

Because the connection is app-only, **SharePoint's own per-file
permissions are not enforced**. Graph sees one identity (the app), so
ShoovaOne itself decides who sees what.

Layers apply:

1. **`documents.view`** — the door to the library at all.
2. **`documents.upload`** — the door to writing files into it. The upload
   control is hidden without this permission and the endpoint refuses it.
3. **Folder rules** — rows in `sharepoint_folder_rules` that name a
   drive-relative path and the permission needed to see that subtree.
   A path covers every descendant; no rule means visible to anyone with
   `documents.view`.
4. **Folder structure changes** — only the exact `ceo` role can create or
   delete folders directly or decide requests. Other users can request
   changes, but cannot perform them. Delete checks reject the root and any
   folder with children.

Defaults seeded by migration `017`:

| Folder | Required permission |
| --- | --- |
| `/Finance` | `finance.view` |
| `/Human Resources` | `hr.view_sensitive` |

Holders of `documents.manage` (CEO, executive director, system admin by
default) add, change and remove rules from the Documents screen. The
server filters listings and search results and refuses direct item lookups,
so a user without the permission cannot see the folder even by URL.

Folder rules also gate uploads: the server resolves the target folder's
path from Graph and refuses the write if a rule covers it and the caller
lacks the rule's permission, so a user cannot drop a file into Finance or HR
by posting a folder id directly.

**The limit of this control:** a copied SharePoint link opens under the
viewer's own Microsoft 365 identity, not through ShoovaOne. If their
SharePoint account has access to the folder, the link opens. Rules shape
what ShoovaOne shows and accepts; they do not replace SharePoint folder
permissions. If Finance or HR files must be truly private, tighten the
sharing on those folders in SharePoint as well.

Other points:

- The client secret lives only in environment variables. It is never
  returned by an endpoint and never written to logs.
- Tokens are held in memory only. Restarting the backend discards them.
- Nothing is copied to ShoovaOne's storage or database; only metadata is
  passed through per request.

---

## 7. Not built yet

Be clear about the boundary before planning work off this guide:

- **No attach picker.** The Documents screen browses, searches and uploads,
  but no record can yet point at a SharePoint file (contract → programme,
  policy → person). That is the next build.
- **No file rename or move.** Folder creation and deletion are limited to
  the CEO-governed workflow above; files are never replaced or removed
  from ShoovaOne.
- **No delta sync or indexing.** Searches go to SharePoint live; ShoovaOne
  does not keep a searchable copy, so results depend on Graph being
  reachable at request time.
- **No thumbnails or previews.** Links open in SharePoint.
- **One library.** One site, one document library per deployment. A
  1 TB library is fine for listing and search; it does not change the
  limits above.
- **Rules match paths, not SharePoint ACLs.** Renaming or moving a
  restricted folder in SharePoint changes its path and the rule stops
  applying until it is updated. Folder ids are stored alongside the path
  to make the rule editable, but path matching is what enforces access.

---

## 8. Where the code lives

| File | Role |
| --- | --- |
| `backend/app/services/integrations/sharepoint.py` | Graph client: token cache, site/drive resolution, listing, search, item lookup, path resolution, upload |
| `backend/app/services/integrations/sharepoint_access.py` | Applies folder rules to listings, search results and upload targets |
| `backend/app/api/v1/endpoints/integrations/sharepoint.py` | Browse, upload and rule endpoints, their error mapping |
| `backend/app/models/sql/core/sharepoint_folder_rule.py` | `sharepoint_folder_rules` model |
| `backend/app/models/sql/core/sharepoint_folder_request.py` | Folder request and decision history model |
| `database/migrations/017_sharepoint_folder_rules.sql` | Table, `documents.manage`, default Finance/HR rules |
| `database/migrations/020_sharepoint_folder_requests.sql` | Folder request table and indexes |
| `backend/app/core/config.py` | `sharepoint_configured`, `sharepoint_missing_settings` |
| `backend/tests/test_sharepoint_client.py` | Offline Graph tests (MockTransport): auth caching, drive selection, ordering, path resolution, folder operations, uploads, validation and errors |
| `backend/tests/test_sharepoint_access.py` | Rule matching: subtree boundaries, case-insensitivity, fail-closed paths |
| `backend/tests/test_sharepoint_upload_endpoint.py` | Upload route: restricted-folder refusal, file-as-folder refusal, path fill-in |
| `frontend/src/services/sharepoint.service.ts` | Typed calls for browsing, uploads, rules and folder requests |
| `frontend/src/features/documents/pages/DocumentsPage.tsx` | Browse, search, upload and access-rule UI |
| `frontend/src/features/documents/components/DocumentNamingAssistant.tsx` | Optional standardized file-name suggestion |
| `frontend/src/features/documents/components/FolderGovernance.tsx` | CEO approval queue and folder request UI |

Run the tests with:

```bash
cd backend
PYTHONPATH=. .venv/Scripts/python -m pytest tests/test_sharepoint_client.py tests/test_sharepoint_access.py -q
```
