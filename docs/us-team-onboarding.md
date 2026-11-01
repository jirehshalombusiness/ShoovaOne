# Working with the U.S. team in ShoovaOne

ShoovaOne runs as **one shared platform**. The Ghana team and the U.S. team
use the same login, the same CRM, the same projects and the same reports.
There is no separate U.S. system and no separate data partition — a country
label on each person is what tells them apart.

This guide explains how that works in practice, what is already automatic,
and what still needs a decision.

---

## 1. The model in one table

| Thing | Where it lives | Shared? |
| --- | --- | --- |
| People directory | People module | Yes — every team member appears once |
| CRM contacts, organisations, deals | CRM module | Yes — a deal won in the U.S. is visible to everyone |
| Projects, milestones, tasks | Projects module | Yes — cross-team by default |
| Compensation records | HR → Compensation | Shared list, separate currency per person |
| Leave, timesheets, attendance | HR / Timekeeping | Shared rules; country is used for public holidays |
| Finance, fund requests | Finance module | Shared ledger |
| Payroll runs | Payroll module | Ghana (GHS / PAYE) today |
| Documents and contracts | Documents module | Shared |

The principle: **one record, many viewers.** If someone needs private
figures, use a role that hides a module — not a second copy of the data.

---

## 2. What "country" actually does

Every person has two fields:

- **Country** — free text, shown on the profile (e.g. `Ghana`, `USA`).
- **Country code** — the stable value: `GH` or `US`. This is what filters,
  reports and defaults use.

The code is filled in automatically when a country is typed:

| You type | Saved code |
| --- | --- |
| `Ghana`, `GH` | `GH` |
| `USA`, `US`, `U.S.`, `United States`, `United States of America` | `US` |
| Anything else | left blank (external partners stay unassigned) |

Staff with no country on record are treated as Ghana-based. External
contacts and partners are deliberately left unassigned.

You never have to type the code. Just type the country correctly.

---

## 3. Adding a U.S. team member

1. Go to **People → Add Person**.
2. Fill in the name, email, job title and department as usual.
3. In the address block, set **Country** to `United States` (or `USA`).
4. Set **Type** to `staff` if they are employed, or `volunteer` / `external_contact` otherwise.
5. Create the user account and assign the role they need (People, CRM, Finance, etc.).
6. If they are paid, add their compensation under **HR → Compensation → Request change**. The currency will default to **USD** for anyone with a U.S. country code.

If you are adding a batch, the same fields can be set from the person edit
dialog — the country code updates automatically when the country changes.

---

## 4. Seeing the U.S. team

**People → Filters → Team** lets you switch between:

- **All Teams** — the whole organisation.
- **Ghana** — `country_code = GH`.
- **United States** — `country_code = US`.

The Total card reflects whatever is selected, so "United States" tells you
the U.S. headcount at a glance. Country is also shown on each row in the
directory.

---

## 5. Money and currency

- Compensation records carry their own currency. A Ghana-based person is
  recorded in **GHS**, a U.S.-based person in **USD**.
- When you pick an employee in the compensation form, the currency follows
  their country. You can still override it — for example a U.S. person paid
  into a Ghana account.
- The Monthly Payroll and Annual Cost cards now show one figure **per
  currency** (e.g. `GHS 84,000 · USD 12,500`). They are never added
  together, because that would be meaningless.

Ghana payroll runs (pay groups, PAYE, SSNIT and the other statutory schemes)
are unchanged and remain GHS-only.

---

## 6. Privacy: what is and isn't possible

ShoovaOne does not hide data by country. That is intentional — the U.S. and
Ghana teams work on the same goals, and separating the data was tried and
rolled back because it broke shared workflows.

What you *can* control today, through roles in **Settings → Roles**:

| Want | Control |
| --- | --- |
| Who sees any salary information | `hr.view_compensation` permission |
| Who can change salary records | `hr.edit_compensation` permission |
| Who sees the finance ledger | `finance.view` and the other `finance.*` permissions |
| Who sees payroll | `payroll.view`, `payroll.view_all` |

So if the Ghana finance team should not see U.S. salaries, the only clean
option with the current permission model is to withhold
`hr.view_compensation` from them entirely. Per-country visibility rules do
not exist and are not planned; if genuinely private figures are needed,
keep them outside the system.

---

## 7. What is not automated for the U.S. team

Be explicit with the team about these gaps:

- **Payroll** — the calculator is built around Ghanaian PAYE, SSNIT and
  GHS. U.S. payroll is not calculated, filed or disbursed by ShoovaOne.
  Record U.S. compensation here for budgeting and approvals, and run the
  actual payroll with your U.S. provider.
- **Public holidays** — the holiday calendar is country-keyed
  (`GH` today). If U.S. leave should follow U.S. holidays, add the U.S.
  calendar under **HR → Leave Policies → Public Holidays** with country
  `US`.
- **Employment contracts** — stored as documents; there is no U.S.
  contract template yet.
- **Statutory reporting** — no U.S. tax forms, 401(k) or state filings.

---

## 8. Technical reference

For whoever maintains the system:

| Item | Detail |
| --- | --- |
| Column | `people.country_code VARCHAR(10)`, indexed |
| Migration | `database/migrations/016_people_country_code.sql` |
| Helpers | `backend/app/core/countries.py` |
| Normalisation | Applied on person create and update in `people.py` |
| List filter | `GET /api/v1/people?country_code=US` |
| Currency default | `default_currency_for(country_code)` in compensation create |
| Frontend filter | `PeopleDirectory` → Team select, `PeopleFilters.country_code` |

Adding a new country means adding it to `COUNTRY_NAMES`, `DEFAULT_CURRENCY`
and `_ALIASES` in `countries.py`, plus an option in the Team filter. No
schema change is needed.

---

## 9. Next step: SharePoint

The planned follow-up is connecting the organisation's SharePoint
(approximately 1 TB) so contracts, donor records and project evidence can
be stored and opened from inside ShoovaOne. That is a separate piece of
work and has not started. When it begins, the design question will be
whether ShoovaOne stores only links and metadata (recommended: the files
stay in SharePoint, permissions are inherited) or mirrors files locally.
