# Shoova ONE — Launch Demo Walkthrough

This document describes the demo environment created on **29 October 2026**: a full production reset that kept only the `admin@shoova.org` super-admin account, followed by a complete rebuild of configuration, people, and three months of simulated usage.

Use it to walk through every module with realistic data, and to understand exactly what each number on screen represents.

For how the finance and payroll screens work in general, see [finance-and-payroll-user-guide.md](finance-and-payroll-user-guide.md). This document is the tour of *this* dataset.

---

## 1. What was reset

| Step | Result |
| --- | --- |
| Full JSON backup of all 82 public tables (572 rows) | `backend/backups/sim_reset_backup_20261029T173316Z.json` |
| Admin account preserved (user + person rows) | `backend/backups/preserved_admin_20261029T173331Z.json` |
| Business data truncated | every table except `schema_migrations` |
| Roles, permissions and grants rebuilt | 12 roles, 74 permissions, 305 grants |
| Configuration seeded | document types, leave types, holidays, payroll components, pay groups, statutory schemes, tax bands |
| Organisation and people seeded | 1 organisation, 8 departments, 20 staff users, 10 learners, 5 partner contacts, 5 external organisations |
| Three months of usage seeded | attendance, timesheets, leave, approvals, projects, programmes, events, meetings, CRM |
| Finance and payroll seeded | 3 pay periods, 6 payroll runs, 5 budgets, 7 fund requests, 5 invoices, and more |

Migration `012_create_programme_academics.sql` was applied as part of the rebuild, which also fixed the earlier `GET /api/v1/programmes` 500 error.

The admin account `admin@shoova.org` was **not** modified. It keeps its existing password and its `ceo` + `system_admin` roles.

---

## 2. Accounts and logins

All seeded staff share the password:

```
ShoovaDemo2026!
```

| Employee # | Name | Email | Role | Pay group | Base (GHS) |
| --- | --- | --- | --- | --- | --- |
| SHO-001 | William Agyekum | william.agyekum@shoova.org | ceo | Leadership | 35,000 |
| SHO-002 | Salome Agyekum | salome.agyekum@shoova.org | director + head_of_finance | Leadership | 26,000 |
| SHO-003 | Kwame Opon-Yeboah | kwame.oponyeboah@shoova.org | executive_director | Leadership | 24,000 |
| SHO-004 | Julius Botchway | julius.botchway@shoova.org | director | Leadership | 19,000 |
| SHO-005 | Wemba Keneh Kweji | wemba.kweji@shoova.org | manager | Leadership | 14,000 |
| SHO-006 | Isaac Waddy Adjei-Ampofo | isaac.adjeiampofo@shoova.org | director | Leadership | 19,000 |
| SHO-007 | Nana Kwasi Appiah | nana.appiah@shoova.org | director | Leadership | 19,000 |
| SHO-008 | Freda Kwarteng-Amaniampong | freda.kwartengamaniampong@shoova.org | manager | Leadership | 13,500 |
| SHO-009 | Solomon Appiah | solomon.appiah@shoova.org | director | Leadership | 18,500 |
| SHO-010 | Efua Owusu-Ansah | efua.owusuansah@shoova.org | head_of_hr | Leadership | 16,000 |
| SHO-011 | Daniel Osei-Bonsu | daniel.oseibonsu@shoova.org | director | Leadership | 18,000 |
| SHO-012 | Gifty Amoako | gifty.amoako@shoova.org | finance_officer | Head Office | 8,500 |
| SHO-013 | Michael Tetteh | michael.tetteh@shoova.org | staff | Head Office | 7,200 |
| SHO-014 | Akosua Frimpong | akosua.frimpong@shoova.org | staff | Head Office | 6,800 |
| SHO-015 | Kofi Boateng | kofi.boateng@shoova.org | staff | Head Office | 7,500 |
| SHO-016 | Abena Serwaa | abena.serwaa@shoova.org | staff | Head Office | 6,500 |
| SHO-017 | Yaw Antwi | yaw.antwi@shoova.org | staff | Head Office | 7,800 |
| SHO-018 | Adwoa Nyarko | adwoa.nyarko@shoova.org | staff | Head Office | 6,000 |
| SHO-019 | Samuel Owusu | samuel.owusu@shoova.org | staff | Head Office | 5,800 |
| SHO-020 | Comfort Adjei | comfort.adjei@shoova.org | staff | Head Office | 5,200 |

Suggested logins for the tour:

- **William** (`william.agyekum@shoova.org`) — everything, including final payroll approval.
- **Salome** (`salome.agyekum@shoova.org`) — finance approvals and payroll finance sign-off.
- **Efua** (`efua.owusuansah@shoova.org`) — HR approvals inbox, leave, timesheets.
- **Gifty** (`gifty.amoako@shoova.org`) — prepares payroll and records payments; cannot approve her own work.
- **Michael** (`michael.tetteh@shoova.org`) — ordinary staff self-service: own attendance, timesheet, payslips, leave.

Demonstration of separation of duties: log in as Gifty and try to approve a payroll run she prepared — the system refuses. Then approve as Salome, then as William.

---

## 3. Data at a glance

| Area | Records |
| --- | --- |
| People | 36 (20 staff, 10 learners, 5 partner contacts, 1 admin) |
| Users / roles / permissions | 21 / 12 / 74 (305 role grants) |
| Departments | 8 (Executive, Finance, Operations, Education, Corporate Affairs, Communication, HR, Programmes) |
| Employment contracts + compensation changes | 20 + 20 |
| Pay profiles / bank accounts / recurring components | 20 / 20 / 40 |
| Loans / installments | 3 / 36 (12 each) |
| Pay periods / payroll runs | 3 / 6 |
| Run items / lines / payslips | 60 / 489 / 40 |
| Statutory remittances / GL entries | 12 / 66 |
| Disbursement batches / items | 5 / 40 |
| Budgets / allocations / fund requests | 5 / 7 / 7 |
| Expenses / reimbursements | 8 / 5 |
| Invoices / payments | 5 / 2 |
| Programmes / courses / cohorts | 4 / 12 / 5 |
| Cohort instructors / enrolments / results | 8 / 12 / 21 |
| Projects / members / milestones / tasks | 5 / 20 / 15 / 30 |
| Attendance days / work sessions | 1,218 / 1,218 (3 Aug – 29 Oct 2026) |
| Timesheets / entries / approval history | 257 / 1,258 / 474 |
| Leave requests | 9 (6 approved, 1 rejected, 2 pending) |
| Events / attendees | 6 / 48 |
| Meetings / attendees | 7 / 33 |
| CRM opportunities / activities | 5 / 10 |
| Documents / devices / device assignments | 10 / 6 / 5 |
| HR notes / compensation requests | 5 / 3 |
| Chat conversations / messages | 3 / 14 |
| Notifications / audit logs | 12 / 20 seeded (+ live entries from your own actions) |

---

## 4. Guided tour

### 4.1 People and HR records

Open **HR → People**. Twenty staff are listed with employee numbers `SHO-001` to `SHO-020`, each linked to a department, a manager, a job title, a location, and a pay profile.

Open any person (for example **Michael Tetteh**) to see:

- Employment contract and initial compensation change (effective 1 August 2026).
- Pay profile: Head Office group, salaried, GHS, cost centre `CC-PROG`.
- Primary bank account or mobile-money wallet (encrypted; only the last four digits are exposed).
- Recurring allowances (transport 800, housing 10% of basic) and, where applicable, an active staff loan.
- Documents: contract, guarantor certificate, police report, bank details, and others. Two are deliberately left **pending verification**.
- HR notes (probation review, attendance follow-up, certification progress).
- Compensation requests: one pending with HR, one pending with the CEO, one approved.

### 4.2 Attendance and timesheets

Attendance covers **3 August to 29 October 2026** — every weekday except the seeded public holidays (4 August and 21 September). Each day has a work session with effective working time.

Open **HR → Timesheets** (as Efua or William):

- 237 approved timesheets and 20 draft timesheets.
- 9,424 approved hours in total, spread across 1,258 project-coded entries.
- The two most recent weeks (26 October) are still in **draft** for some staff — exactly what an in-progress week should look like.
- Open a timesheet to see daily entries, project/task coding, billable flags, and the approval history (submitted → approved).
- As Michael, open **My Timesheet** to see only his own week and the submit button.

### 4.3 Leave and approvals

Open **HR → Leave** and the **Approvals** inbox:

- 6 approved requests: annual leave (Michael, Comfort, Samuel), sick (Abena), compassionate (Kofi), study (Yaw).
- 1 rejected request: Adwoa's annual leave, with a rejection reason.
- 2 pending requests: Akosua (sick, 28–29 October) and Gifty (annual, 30 October – 3 November).

The approvals inbox also contains pending timesheet approvals and the HR stage of a compensation request. Logging in as Efua shows the HR queue; as William, the CEO stage.

### 4.4 Payroll

Open **Payroll → Pay Periods** and **Payroll → Runs**.

Three monthly periods exist: August, September (both closed) and October (open). Six runs were created — one per pay group per month:

| Run | Period | Group | Status | Employees | Gross | Employee deductions | Employer contributions | Net | Employer cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PR-2026-08-LEAD | Aug 2026 | Leadership | paid | 11 | 258,500.00 | 88,977.14 | 39,960.00 | 169,522.86 | 298,460.00 |
| PR-2026-08-HO | Aug 2026 | Head Office | paid | 9 | 79,130.00 | 23,167.96 | 11,034.00 | 55,962.04 | 90,164.00 |
| PR-2026-09-LEAD | Sep 2026 | Leadership | paid | 11 | 258,500.00 | 88,977.14 | 39,960.00 | 169,522.86 | 298,460.00 |
| PR-2026-09-HO | Sep 2026 | Head Office | paid | 9 | 79,130.00 | 23,167.96 | 11,034.00 | 55,962.04 | 90,164.00 |
| PR-2026-10-LEAD | Oct 2026 | Leadership | hr_approved | 11 | 258,500.00 | 88,977.14 | 39,960.00 | 169,522.86 | 298,460.00 |
| PR-2026-10-HO | Oct 2026 | Head Office | calculated | 9 | 79,130.00 | 23,167.96 | 11,034.00 | 55,962.04 | 90,164.00 |

Across the four paid runs: **gross 675,260.00**, **net 450,969.80**, **employer cost 777,248.00**.

Open **PR-2026-09-LEAD** to see the full lifecycle evidence:

- Approval trail: HR (Efua) → Finance (Salome) → Final (William), each with a timestamp and note.
- 11 run items with department, cost centre, locked timesheet hours, and per-person totals.
- 489 lines in total across the six runs. Each item carries `BASIC`, `TRANSPORT`, `HOUSING`, `MEDICAL`, `T1`, `T1_EMPLOYER`, `T2_EMPLOYER`, `PAYE`, and `STAFF_LOAN` where applicable.
- 40 payslips (August and September) with correct year-to-date accumulation.
- 12 statutory remittances (Tier 1, Tier 2, PAYE for each paid run).
- 66 posted GL entries that balance exactly to zero per run.
- 5 disbursement batches: four paid, plus a **draft** batch for October Leadership awaiting finance approval.

**A worked example — William, August 2026**

| Line | Amount (GHS) |
| --- | --- |
| Basic salary | 35,000.00 |
| Housing allowance (10% of basic) | 3,500.00 |
| Transport allowance | 800.00 |
| Medical allowance | 500.00 |
| **Gross pay** | **39,800.00** |
| SSNIT Tier 1 employee (5.5% of basic) | −1,925.00 |
| PAYE (progressive, on 38,500 taxable less 1,925 SSNIT) | −12,398.58 |
| **Net pay** | **25,476.42** |
| Employer: Tier 1 (13%) + Tier 2 (5%) | 6,300.00 |
| **Employer cost** | **46,100.00** |

Housing is taxable; transport and medical are not. Tier 1 and Tier 2 are calculated on basic salary, PAYE on taxable gross less the employee's Tier 1 contribution. These are the same rules the payroll engine applies in `backend/app/services/payroll/calculator.py`.

**Loans:** Michael (6,000 @ 500/month), Kofi (3,600 @ 300/month) and Adwoa (2,400 @ 200/month) each have 12 installments. Two installments are marked paid and linked to the August and September run items; outstanding balances are 5,000 / 3,000 / 2,000.

### 4.5 Finance

Open **Finance → Overview** first. The dashboard reflects the seeded data:

- 7 fund requests: 2 pending, 3 approved, 2 disbursed.
- GHS fund requests: 285,800 requested, 133,500 approved, 73,500 disbursed.
- 8 expenses totalling 58,850, with 22,400 already paid.
- 2 expenses and 1 fund request awaiting reconciliation.

Then walk the chain:

**Budgets → Allocations → Fund requests → Expenses → Reimbursements → Invoices → Payments**

| Record | What to look at |
| --- | --- |
| `BUD-2026-001` FY2026 Operating Budget (1,200,000, active) | submitted → approved → activated timestamps |
| `BUD-2026-004` Communications Budget (250,000, submitted) | waiting for approval |
| `BUD-2025-001` FY2025 Operating Budget (800,000, closed) | closed lifecycle |
| `ALLOC-2026-003` Digital Skills Cohort Delivery (250,000) | active, linked to programme DSE |
| `ALLOC-2026-005` Youth Entrepreneurship Accelerator (220,000) | submitted |
| `FR-2026-001` Digital Learning Platform hosting (45,000) | fully reconciled |
| `FR-2026-002` Health outreach supplies (28,500) | disbursed, not yet reconciled |
| `FR-2026-006` STEM lab equipment (120,000) | rejected with a reason |
| `EXP-2026-001` Cohort graduation venue (12,400) | reconciled |
| `EXP-2026-007` Venue deposit (18,000) | rejected |
| `RMB-2026-005` Client lunch (3,100) | reconciled |
| `INV-2026-001` Mastercard Foundation (250,000) | issued → paid in full |
| `INV-2026-002` UNICEF Ghana (120,000) | partially paid: 60,000 received |
| `INV-2026-003` Stanbic Bank (45,000) | issued, unpaid |
| `INV-2026-005` USAID Ghana (200,000) | cancelled with a reason |

Payments `PAY-2026-001` and `PAY-2026-002` match the invoice `amount_paid` figures exactly.

### 4.6 Programmes

Open **Programmes**:

- **DSE** Digital Skills for Employment — active, Certificate, 3 courses, cohort DSE-2026A completed and DSE-2027A planned.
- **YEF** Youth Entrepreneurship Fellowship — active, 3 courses, cohort YEF-2026A active.
- **CHWT** Community Health Worker Training — completed, 3 courses, cohort CHWT-2026A completed.
- **DAB** Data Analytics Bootcamp — planned, 3 courses, cohort DAB-2027A planned.

Open a cohort to see instructors, 12 enrolments, and 21 published results (scores and grades).

### 4.7 Projects and tasks

Open **Projects**:

| Code | Project | Budget |
| --- | --- | --- |
| PRG-DLP | Shoova Digital Learning Platform | 250,000 |
| PRG-GYEA | Ghana Youth Entrepreneurship Accelerator | 180,000 |
| PRG-CHO | Community Health Outreach 2026 | 120,000 |
| PRG-STEM | STEM Education Expansion | 300,000 |
| PRG-DATA | Organisational Data & Reporting Upgrade | 90,000 |

Each has 4 members, 3 milestones, and 6 tasks in mixed states. Timesheet entries are coded against these projects and tasks, so project time and cost roll-ups have real data behind them.

### 4.8 Events and meetings

**Events** (6):

- Digital Skills Cohort 1 Orientation — 17 Aug, completed
- Annual General Meeting 2026 — 12 Sep, completed
- Community Health Outreach — Kaneshie — 26 Sep, completed
- Staff Retreat & 2027 Planning — 6 Nov, published
- Shoova Fundraising Gala 2026 — 21 Nov, published
- Entrepreneurship Pitch Night — 4 Dec, draft

Each event has attendees (48 in total) and organiser/department links.

**Meetings** (7): three Leadership Weekly Syncs, Q3 Finance Review, Programme Leads Check-in, HR Policy Review, and a scheduled Board Preparation Session. The meetings list defaults to *upcoming*; switch the window to **All** to see the completed history.

### 4.9 CRM

Open **CRM → Opportunities**. Five deals across stages:

- Mastercard Foundation Grant 2026 — 1,200,000, negotiation, 75%
- UNICEF Ghana Partnership — 450,000, proposal, 50%
- Stanbic Bank CSR Partnership — 300,000, qualified
- MTN Ghana Foundation STEM — 250,000, contact made
- USAID Ghana Youth Grant — 150,000, lost with a reason

Each has qualification criteria, activities, stage history, and contributors.

### 4.10 Chat and notifications

**Chat** has three conversations:

- **Leadership Team** — group channel with all 11 leaders, 9 messages.
- **Direct thread** between Gifty and Salome about the UNICEF invoice balance.
- **Programme Delivery** — group awaiting approval, with 2 messages.

**Notifications** are spread across users: payroll approval requests, leave alerts, payslip availability, invoice overdue, timesheet reminders, event reminders, and a chat mention. The bell badge count comes from unread rows.

---

## 5. What each role sees

| Login | Role | Sees |
| --- | --- | --- |
| admin@shoova.org | ceo + system_admin | everything, plus user/role administration |
| william.agyekum | ceo | everything; final payroll approval |
| kwame.oponyeboah | executive_director | all business modules except user/role/system administration |
| salome.agyekum | director + head_of_finance | finance and payroll finance approval, plus director scope |
| efua.owusuansah | head_of_hr | people, HR, attendance, documents, payroll HR approval |
| gifty.amoako | finance_officer | prepares finance and payroll records; cannot approve them |
| julius.botchway | director | director-scoped access |
| michael.tetteh | staff | self-service: own attendance, timesheet, leave, payslips |

Use these differences to demonstrate the permission model during the walkthrough.

---

## 6. Verification performed

The following were checked after seeding:

**Payroll reconciliation**

- Run totals equal the sum of their items for gross, net, employer contributions and employer cost.
- Earnings lines sum to gross pay for every run.
- GL entries net to **0.00** for each paid run.
- Payslip YTD accumulates correctly (August = month, September = August + September).
- Loan outstanding balances equal principal less paid installments.

**Finance reconciliation**

- Invoice `amount_paid` equals the sum of recorded payments.
- Fund request requested/approved/disbursed totals match the Finance Overview.
- Expense paid totals match the overview.

**API smoke test** (in-process server against the seeded production database)

| Endpoint | Result |
| --- | --- |
| `GET /health` | 200 |
| `POST /api/v1/auth/login` (CEO and staff) | 200 |
| `GET /api/v1/programmes?limit=200` | 200 |
| `GET /api/v1/payroll/runs` and `/payroll/runs/{id}` | 200 |
| `GET /api/v1/payroll/me/profile` and `/payroll/me/payslips` | 200 |
| `GET /api/v1/finance/overview`, budgets, allocations, fund-requests, expenses, reimbursements, invoices | 200 |
| `GET /api/v1/hr/employees`, documents, contracts, compensation, leave policies | 200 |
| `GET /api/v1/me/home`, `/me/time-off/balances`, `/me/approvals` | 200 |
| `GET /api/v1/timesheets/team`, `/timesheets/my` | 200 |
| `GET /api/v1/attendance/today` | 200 |
| `GET /api/v1/events`, `/meetings?window=all`, `/crm/opportunities` | 200 |
| `GET /api/v1/chat/conversations` | 200 |
| `GET /api/v1/notifications` and `/notifications/unread` | 200 |

---

## 7. Demo caveats

- **Documents** point at placeholder URLs under `https://files.shoova.org/demo/`. Records, verification states and expiries are real; the files themselves are not stored.
- **Bank file hashes and provider references** are synthetic strings. No bank file was generated or uploaded.
- **Payroll amounts** were produced by a seed script that mirrors `calculator.py` exactly. Recalculating a run through the UI with the same inputs produces the same figures.
- **August and September runs are identical** because no salary changes or new joiners occurred between them. That is intentional; use October's pending runs to demonstrate approval and adjustment flows.
- **No email, SMS or push messages** were sent. In-app notifications only.
- **Audit logs** grow as you use the system; the seeded 20 cover the main events of the three months.
- **Attendance** excludes weekends and the seeded public holidays but does not model half-days or remote check-ins separately.

---

## 8. Rebuilding the environment

All scripts live in `backend/scripts/` and must be run **from the `backend/` directory** so that `.env` loads the production connection string.

```bash
cd backend

# 1. Back up everything
python scripts/sim_backup.py

# 2. Wipe business data, keeping the admin account
CONFIRM_RESET=yes python scripts/sim_reset.py
python scripts/sim_restore_admin.py        # only if the admin row needs re-inserting

# 3. Rebuild access control and configuration
python scripts/sim_rebuild_access.py
python scripts/sim_seed_config.py

# 4. Seed people and organisation
python scripts/sim_seed_people.py

# 5. Seed three months of usage
python scripts/sim_seed_work.py

# 6. Seed finance, payroll and supporting records
python scripts/sim_seed_finance_payroll.py
```

Each seed script refuses to run if its target tables already contain data, so the sequence is effectively one-shot.

**Backups produced for this run**

- `backend/backups/sim_reset_backup_20261029T173316Z.json` — full pre-reset snapshot (572 rows).
- `backend/backups/preserved_admin_20261029T173331Z.json` — admin user and person rows.
- `backend/backups/sim_lookup.json` — IDs of the seeded organisation, departments, people and users.
- `backend/backups/sim_work_lookup.json` — IDs of seeded programmes, cohorts, courses, projects and leave types.

> **Warning:** these scripts write to whatever `backend/.env` points at. That is currently production Supabase. Do not re-run them without explicit approval, and never run the seeds against a live tenant that contains real data.

---

## 9. Suggested walkthrough order

1. Log in as **William**. Look at the dashboard and notification bell.
2. **HR → People** → open Michael → review contract, documents, notes, compensation request.
3. **HR → Timesheets** → open last week's draft and an approved week.
4. **HR → Approvals** → clear nothing; just inspect the pending items as Efua, then as William.
5. **Payroll → Runs** → open `PR-2026-09-LEAD` → items → lines → payslips → remittances → GL → batch.
6. **Payroll → Runs** → open `PR-2026-10-LEAD` and continue the approval flow as Salome, then William.
7. **Finance → Overview** → drill into each aging/pending item.
8. **Finance → Budgets → Allocations → Fund requests** → follow `FR-2026-002` from submission to disbursement.
9. **Finance → Invoices** → open the partially paid UNICEF invoice and record a second payment.
10. **Programmes** → open DSE-2026A → results; **Projects** → PRG-DLP → tasks.
11. **Events** and **Meetings** → check upcoming items.
12. **CRM** → open the Mastercard opportunity and advance its stage.
13. Log in as **Michael** and show the staff self-service view: attendance, timesheet, payslip, leave.
14. Log in as **Gifty** and demonstrate the separation-of-duties block on approval.
