# SharePoint integration

ShoovaOne connects to the organisation's SharePoint library so contracts,
policies and programme files can be browsed from inside the platform.
Files are **not copied**. ShoovaOne asks Microsoft Graph for the folder
listing and gets back a `webUrl` that opens the original file in SharePoint.

The connection is app-only (client credentials): ShoovaOne signs in as
itself, not as whichever person is browsing.

---

## 1. Current state

| Item | Status |
| --- | --- |
| Graph client (token, site, drive, listing, search) | Built and tested |
| API endpoints `/api/v1/integrations/sharepoint/*` | Built, behind `documents.view` |
| Settings in `backend/.env` | Present locally |
| Azure application permission | `Sites.Selected` granted, plus broad `Sites.*` roles kept for later |
| Settings on Render (production) | Configured — connection verified live on 2026-11-01 |
| Documents browse / search UI | Built at `/documents` (2026-11-01) |
| Folder access rules | Built — `/Finance` and `/Human Resources` restricted by permission |

Production check on 2026-11-01 returned `configured: true, reachable: true` for
`Shoova Initiative Portal` / `Documents`, listed the 7 root folders, read a
nested file's metadata and found it by search.

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

Least privilege: the app can only read sites that are explicitly granted
to it.

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

   `-Permissions Read` allows listing and metadata. Use `Write` only if
   ShoovaOne will ever upload or replace files; the current code does not.

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

Browsing endpoints require `documents.view`; the rules endpoints require
`documents.manage`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/integrations/sharepoint/status` | Configuration + live reachability |
| GET | `/api/v1/integrations/sharepoint/items?folder_id=&q=` | List a folder, or search |
| GET | `/api/v1/integrations/sharepoint/items/{item_id}` | One file/folder's metadata |
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

Errors: `503` when the integration is not configured, `502` when Graph
rejects or fails the call, `403` when the user lacks the required
permission, `404` for restricted items.

Paging is fixed at 200 items per folder and 100 search results. Nothing
follows `@odata.nextLink` yet — a folder with more than 200 direct
children shows the first 200.

---

## 6. Security model — read this before going live

Because the connection is app-only, **SharePoint's own per-file
permissions are not enforced**. Graph sees one identity (the app), so
ShoovaOne itself decides who sees what.

Two layers apply:

1. **`documents.view`** — the door to the library at all.
2. **Folder rules** — rows in `sharepoint_folder_rules` that name a
   drive-relative path and the permission needed to see that subtree.
   A path covers every descendant; no rule means visible to anyone with
   `documents.view`.

Defaults seeded by migration `017`:

| Folder | Required permission |
| --- | --- |
| `/Finance` | `finance.view` |
| `/Human Resources` | `hr.view_sensitive` |

Holders of `documents.manage` (CEO, executive director, system admin by
default) add, change and remove rules from the Documents screen. The
server filters listings and search results and refuses direct item lookups,
so a user without the permission cannot see the folder even by URL.

**The limit of this control:** a copied SharePoint link opens under the
viewer's own Microsoft 365 identity, not through ShoovaOne. If their
SharePoint account has access to the folder, the link opens. Rules shape
what ShoovaOne shows; they do not replace SharePoint folder permissions.
If Finance or HR files must be truly private, tighten the sharing on those
folders in SharePoint as well.

Other points:

- The client secret lives only in environment variables. It is never
  returned by an endpoint and never written to logs.
- Tokens are held in memory only. Restarting the backend discards them.
- Nothing is copied to ShoovaOne's storage or database; only metadata is
  passed through per request.

---

## 7. Not built yet

Be clear about the boundary before planning work off this guide:

- **No attach picker.** The Documents screen browses and searches the
  library, but no record can yet point at a SharePoint file (contract →
  programme, policy → person). That is the next build.
- **No upload, rename, move or delete.** Read-only.
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
| `backend/app/services/integrations/sharepoint.py` | Graph client: token cache, site/drive resolution, listing, search, item lookup, path resolution |
| `backend/app/services/integrations/sharepoint_access.py` | Applies folder rules to listings and search results |
| `backend/app/api/v1/endpoints/integrations/sharepoint.py` | Browse and rule endpoints, their error mapping |
| `backend/app/models/sql/core/sharepoint_folder_rule.py` | `sharepoint_folder_rules` model |
| `database/migrations/017_sharepoint_folder_rules.sql` | Table, `documents.manage`, default Finance/HR rules |
| `backend/app/core/config.py` | `sharepoint_configured`, `sharepoint_missing_settings` |
| `backend/tests/test_sharepoint_client.py` | Offline Graph tests (MockTransport): auth caching, drive selection, ordering, path resolution, id validation, error messages |
| `backend/tests/test_sharepoint_access.py` | Rule matching: subtree boundaries, case-insensitivity, fail-closed paths |
| `frontend/src/features/documents/pages/DocumentsPage.tsx` | Browse, search, manage-access panel and per-folder rule dialog |

Run the tests with:

```bash
cd backend
PYTHONPATH=. .venv/Scripts/python -m pytest tests/test_sharepoint_client.py tests/test_sharepoint_access.py -q
```
