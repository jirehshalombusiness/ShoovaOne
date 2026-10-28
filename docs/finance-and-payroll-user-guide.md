# Shoova ONE — Finance & Payroll User Guide

A practical guide to running money in Shoova ONE: budgets, fund requests, spending, receivables, and the full payroll cycle.

Last verified: 28 October 2026, against the current codebase and production data.

---

## 1. The big picture

### 1.1 Two modules, one chain

Finance and Payroll are separate menus but one continuous flow of money:

```
PLAN            REQUEST              APPROVE                PAY                    PROVE
Budget   →   Fund Request    →    Review + Approve   →   Disburse / Pay   →   Reconcile
Allocation
```

Payroll is its own chain that ends in the same place:

```
Configure → Set up pay → Run payroll → HR sign-off → Finance review → Final approval
          → Finalize (payslips + ledger) → Payment batch → Paid → Remittances
```

Everything is status-driven. A record moves forward only when someone presses the right button in the right status, and most records become read-only once they move.

### 1.2 The rule that shapes everything: separation of duties

The system is built so that one person cannot create, approve, and pay the same money. Expect these refusals — they are deliberate:

| Action | Who is blocked |
|---|---|
| Review a fund request you created | The requester |
| Approve a fund request you reviewed | The reviewer |
| Reject your own request | The requester |
| Disburse/pay a request or expense you raised | The requester |
| Approve a pay run you calculated | The preparer |
| Finance-review a run you HR-signed | The HR signer |
| Give final approval to a run you prepared | The preparer |
| Final-approve a run you finance-reviewed | The finance reviewer |
| Approve a payment batch you created | The batch creator |
| Approve a loan you created | The creator |
| Verify bank details you captured | The capturer |

If your organisation is small, you will need at least two people with the right permissions to complete a cycle. Plan the roles accordingly.

### 1.3 Where things live

Global sidebar: **Finance** and **Payroll**.

Finance secondary menu (`/finance`):

| Section | Item | URL |
|---|---|---|
| — | Overview | `/finance` |
| Fund Management | Fund Requests | `/finance/fund-requests` |
| Fund Management | Approvals | `/finance/approvals` |
| Fund Management | Disbursements | `/finance/disbursements` |
| Expenditure | Expenses | `/finance/expenses` |
| Expenditure | Reimbursements | `/finance/reimbursements` |
| Receivables | Invoices | `/finance/invoices` |
| Receivables | Payments | `/finance/payments` |
| Planning | Budgets | `/finance/budgets` |
| Planning | Allocations | `/finance/allocations` |
| Payroll | Payroll Overview / Pay Runs / Payroll Disbursements / Payroll Setup | `/payroll`, `/payroll/runs`, `/payroll/disbursements`, `/payroll/config` |
| Reporting | Financial Reports | `/finance/reports` |
| Reporting | Reconciliation | `/finance/reconciliation` |

Payroll secondary menu: **Overview** (`/payroll`), **Pay Runs**, **Employee Pay** (`/payroll/people`), **Disbursements**, **Reports** (`/payroll/reports`), **Configuration** (`/payroll/config`).

Employee self-service: **Payslips** at `/me/payslips`.

The Finance header button is **New Fund Request**; the Payroll header button is **Prepare Pay Run**. Menu items you cannot use are hidden, not greyed out.

---

## 2. Access: permissions and roles

### 2.1 Two separate things

- A **role** is a bundle (CEO, Finance Manager, Staff…).
- A **permission** is a single ability (`finance.approve`, `payroll.prepare`…).

You normally grant a role and inherit its permissions. The **Users** page can also grant a permission directly to one person (Permissions button), which is useful for temporary cover and should be removed afterwards.

### 2.2 Who can do what today

This is the live mapping in production. The CEO bypasses every check.

| Role | Finance | Payroll |
|---|---|---|
| **CEO** | Everything | Everything |
| **Finance Manager** | Full: create, edit, review, approve, reject, disburse, reconcile, reports, manage | Approve, config, disburse, finance review, reports, view all |
| **Finance Officer** | View only | Disburse, finance review, reports, view all |
| **Head of Finance** | None currently | Approve, config, disburse, finance review, reports, view all |
| **Head of HR** | View | Prepare, HR review, config, reports, view all |
| **Executive Director** | None currently | Approve, reports, view all |
| **Director** | Approve only (no view — see §8) | Own payslips |
| **Manager / Staff / Volunteer** | None | Own payslips |
| **System Administrator** | None | None |

Payroll has one deliberate exception to the permission model: **everyone with `payroll.view_own` can see only their own payslips**, and payslips are only visible after a run is finalized.

### 2.3 Granting access

- **Role to a person:** Users → find the person → **Edit Roles**.
- **One-off permission:** Users → **Permissions** → pick from **Grant Direct Permission**.
- **Change what a role can do:** Roles & Permissions → select role → tick permissions.

Only the CEO can assign the protected roles (`ceo`, `system_admin`, `executive_director`, `head_of_hr`), and only the CEO can grant `users.manage`, `roles.manage`, `system.manage`, `finance.approve`, `finance.disburse`, `finance.manage`, `payroll.approve`, `payroll.disburse` and `payroll.config`.

---

## 3. Finance, step by step

### 3.1 Budgets — the plan

**Purpose:** define how much money a unit has for a period.

**Flow:** `draft → submitted → approved → active → closed`

1. Finance → **Budgets** → **New Budget**.
2. Fill **Budget Name**, **Fiscal Year**, **Currency**, **Start Date**, **End Date**, **Budget Amount**; optionally Department / Programme / Project and **Description** / **Notes**.
3. **Create Budget**.
4. Open it and press **Submit for Approval**.
5. Someone with `finance.approve` presses **Approve Budget**.
6. Press **Activate Budget** — only an approved budget can be activated, and only active budgets can receive allocations.
7. At year end, **Close Budget** (final; asks for confirmation).

Rules:

- Only **draft** and **submitted** budgets can be edited ("Only draft and submitted budgets can be edited.").
- Closing is final.
- Unlike fund requests, the system does **not** block self-approval of a budget. Make sure the approver is genuinely independent.

### 3.2 Allocations — the envelope

**Purpose:** carve a budget into a specific spend pot (e.g. "Q3 transport" from the Operations budget).

**Flow:** `draft → submitted → approved → active → closed`

1. Finance → **Allocations** → **Create Allocation**.
2. Choose the **Budget** (must be approved or active), then **Allocation Name**, **Allocation Amount**, **Currency**, and optional department/programme/project.
3. **Create Allocation** → **Submit** → **Approve** → **Activate**.

Rules:

- Currency must match the parent budget.
- The amount cannot exceed the budget amount or what is left after other non-closed allocations. There is no "over-budget override" button.
- Only the budget's department/programme/project should be used, otherwise reporting by department will not line up.
- Self-approval is not blocked here either.

> **Important limitation:** expenses and reimbursements are **not** linked to allocations. An allocation is a planning and reporting tool — it does not hard-stop spending. Only allocation creation itself is capped by the budget.

### 3.3 Fund requests — asking for money

**Purpose:** the formal request that releases funds for an activity.

**Flow:** `draft → submitted → under review → approved → disbursed → reconciled` (with `rejected` possible from submitted/under review)

1. Finance → **Fund Requests** → **New Fund Request** (or the header button).
2. **Request Title** (required), **Description**, **Business Justification**.
3. **Organisation** (read-only), **Department** (required), **Programme**, **Project**.
4. **Amount Requested** (required, above zero), **Currency** (GHS/USD/EUR/GBP), **Required By**.
5. Press **Submit Request** (or **Save Draft**).

Then:

| Step | Screen / button | Who |
|---|---|---|
| Submit | **Submit Request** | Requester (`finance.create`) |
| Take it up | **Review Request** → **Start Review** | Reviewer (`finance.review`), not the requester |
| Approve | **Approve Request** → set approved amount + notes → **Approve** | Approver (`finance.approve`), not the reviewer |
| Release money | **Disburse Funds** → **Record Disbursement** | Finance (`finance.disburse`), not the requester |
| Prove the spend | **Reconcile** | Finance (`finance.reconcile`) |
| Refuse | **Reject Request** + reason (min 3 characters) | Reviewer/approver (`finance.reject`) |

Rules:

- Approved amount cannot exceed the requested amount.
- You can disburse in parts; the record only becomes **Disbursed** when the approved amount is fully released.
- Reconciliation is only allowed once fully disbursed.
- The detail page shows Requested / Approved / Disbursed / Remaining plus the approval trail.
- **A draft cannot be edited in the UI** — there is no Edit screen for fund requests. There is also no delete. Check before pressing **Save Draft**; if you need changes, submit and ask for a rejection, or raise a new request.

### 3.4 Expenses — spending that already happened or is about to

**Purpose:** record a cost against a department/programme/project.

**Flow:** `draft → submitted → under review → approved → paid → reconciled` (plus `rejected`)

1. Finance → **Expenses** → **New Expense**.
2. **Expense Title**, **Category** (Operations, Transport, Travel, Accommodation, Supplies, Equipment, Utilities, Professional Services, Programme Activity, Project Activity, Staff Welfare, Communications…), **Expense Date**, **Amount**, **Currency**, **Description**.
3. Organisation / **Department** / Programme / Project.
4. **Vendor / Payee**, **Reference**, **Payment Method** (Bank Transfer, Mobile Money, Cash, Card, Cheque, Other).
5. **Save Draft** or **Create & Submit**.

Then on the detail page: **Submit Expense** → **Move to Review** → **Approve Expense** → **Record Payment** → **Reconcile Expense**. **Reject** requires a reason.

Rules:

- Only the creator can edit a draft; there is no edit screen in the UI, so treat **Create & Submit** as final.
- The creator cannot review, approve, or pay their own expense.
- Rejected expenses cannot proceed — raise a new one.
- Expenses are not capped by allocations or budgets.

### 3.5 Reimbursements — paying a person back

Same chain as expenses: `draft → submitted → under review → approved → paid → reconciled`.

1. Finance → **Reimbursements** → **New Reimbursement**.
2. **Reimbursement Title**, **Category**, **Expense Date**, **Amount**, **Currency**, **Business Purpose / Description**.
3. Organisation / **Department** / Programme / Project.
4. **Vendor / Payee** (the person being reimbursed), **Vendor / Transaction Reference**, **Personal Payment Method**.
5. **Save Draft** or **Create & Submit**.

Buttons on the detail page: **Submit Reimbursement**, **Review Reimbursement** (with **Review Notes**), **Approve Reimbursement**, **Reject**, **Record Payment**, **Reconcile**.

### 3.6 Invoices — money coming in

**Purpose:** bill a customer.

**Statuses:** `draft → issued → partially paid → paid`, plus `cancelled`. **Overdue** is calculated from the due date — it is not a stored status, so an invoice can show both "Issued" and "Overdue".

1. Finance → **Invoices** → **New Invoice**.
2. **Customer Name**, **Email**, **Phone**, **Billing Address**.
3. **Invoice Title**, **Description**, **Amount**, **Currency**, **Issue Date**, **Due Date** (cannot be before issue date).
4. Department / Programme / Project, **Invoice Notes**.
5. **Save Draft** or **Create & Issue**.

Detail page: **Print**, **Download PDF** (opens the print dialog), **Issue Invoice**, **Cancel**.

Rules:

- A draft invoice can be cancelled; an invoice with any recorded payment cannot.
- The amount cannot be reduced below what has already been paid.

### 3.7 Payments — recording money received

**Statuses:** `completed` or `cancelled`.

1. Finance → **Payments** → **Record Payment**.
2. **Invoice**, **Payment Amount**, **Payment Date**, **Payment Method**, **Payment Reference**, **Payer Name**, **Payer Email**, **Notes**.

Rules:

- You can only pay an **issued** or **partially paid** invoice — not a draft or cancelled one.
- Overpayment is blocked: the system tells you the outstanding balance.
- Currency must match the invoice currency.
- Cancelling a payment removes it from the invoice's paid amount, which can push a "paid" invoice back to "partially paid". A reason is required.

### 3.8 Disbursements — the release queue

Finance → **Disbursements** shows what has been approved but not yet released, split into **Pending Disbursement** and **Disbursed**, with **Ready to Disburse / Partially Disbursed / Fully Disbursed / Outstanding Value** at the top.

This page is a queue — you do not release money here. Open the fund request and use **Disburse Funds**.

### 3.9 Reconciliation — closing the loop

Finance → **Reconciliation** has **Pending** and **Reconciled** tabs.

- Fund requests appear once fully disbursed → **Reconcile**.
- Expenses and reimbursements appear once paid → **Reconcile Expense** / **Reconcile**.

The sidebar footer shows "N to reconcile" or "All reconciled". A clean month means zero pending.

### 3.10 Reports and the overview

**Overview** (`/finance`): Funds Requested / Approved / Disbursed / Paid Expenses, Management Attention items, Funding Analysis by currency (converted to USD using live exchange rates), expenditure breakdown, workflow control, and open reconciliation. If the rate service is down, the overview fails with "Unable to convert … funding totals to USD."

**Financial Reports** (`/finance/reports`): choose **Currency**, **Fiscal Year**, **Start Date**, **End Date**, optionally **Include paid invoices**, then **Apply Filters**. Sections: Financial Summary, Budget vs Actual, Income & Expenditure, Fund Flow, Receivables. **Print** produces the PDF.

Rules:

- Budget vs Actual counts expenses and reimbursements in `approved`, `paid`, or `reconciled` status, matched by date range and department/programme/project.
- Reports do **not** convert currency. Amounts in a currency different from the filter are treated as zero, so run one report per currency for accurate totals.

### 3.11 Finance status reference

| Record | Statuses |
|---|---|
| Budget | Draft, Submitted, Approved, Active, Closed |
| Allocation | Draft, Submitted, Approved, Active, Closed |
| Fund request | Draft, Submitted, Under Review, Approved, Rejected, Disbursed, Reconciled |
| Expense | Draft, Submitted, Under Review, Approved, Rejected, Paid, Reconciled |
| Reimbursement | Draft, Submitted, Under Review, Approved, Rejected, Paid, Reconciled |
| Invoice | Draft, Issued, Partially Paid, Paid, Cancelled (+ derived Overdue) |
| Payment | Completed, Cancelled |

### 3.12 Finance rules worth memorising

1. **Currency is copied, not converted.** Allocations must match their budget; payments must match their invoice.
2. **Approved amount ≤ requested amount; disbursed ≤ approved.**
3. **Only the creator can edit a draft**, and only while it is still a draft.
4. **Reviewed-by and approved-by must be different people** for fund requests and expenses.
5. **Reconciliation is the last step** — it is how you prove the money was used as approved.
6. **Allocations do not block expenses.** Budget control is via approval, not automation.

---

## 4. Payroll, step by step

### 4.1 One-time setup — Payroll → Configuration

Four tabs, all requiring `payroll.config`:

**Pay periods** — the calendar. **Add period** for one period, or **Generate schedule** to create a year at a time. Each period has start/end dates and a cutoff.

**Pay groups** — how people are paid together. **Add group**: name, **pay type** (salaried / hourly / mixed), currency, whether overtime is eligible, and proration basis (working days or calendar days). You need at least one period and one group before a run can be created.

**Statutory schemes** — tax, SSNIT/PF, and similar. **Add scheme** with employee rate, employer rate, calculation base (basic / gross / taxable), optional cap, effective dates, and tax bands. Rates are decimals (`0.055` = 5.5%).

> Statutory rates and tax bands are **immutable once saved**. To change a rate, create a new effective-dated scheme; the old one stays for history.

**Pay components** — recurring earnings and deductions (allowances, loans handled separately). **Add component**: name, category (earning / employee deduction / employer contribution), calculation (fixed or percent), calculation base, default amount, and GL account.

### 4.2 Employee pay setup — Payroll → Employee Pay

Two tabs: **Pay profiles** and **Employee setup**.

**Set up pay** (or **Update**) for a person:

- Pay group, pay type, currency
- Base amount per period, hourly rate
- Overtime multiplier (default 1.5)
- Payment method, effective from, department, cost centre, notes

Profiles are effective-dated: a new profile closes the previous one. That is how you record a raise without editing history.

### 4.3 Bank accounts

**Add account**: bank name, account name, account number, branch, bank code, mobile money provider, effective from, "Use as primary salary account".

- Account numbers are encrypted at rest. Only the **last four digits** are ever shown back to users.
- New accounts start **Pending** and must be **Verify**d or **Reject**ed by a different person with `payroll.review_finance` or `payroll.approve`. The capturer cannot verify their own entry.
- The full account number only appears inside the generated bank payment CSV — treat that file as confidential.

### 4.4 Recurring components and loans

- **Add component** on the person: pick the component, amount or rate, effective from, remaining amount (for capped items), notes.
- **Add loan**: principal, annual interest %, monthly installment, term in months, start date. The creator cannot approve the loan; someone with `payroll.approve` or `payroll.review_finance` must.

### 4.5 The pay run, stage by stage

**Statuses:** `draft → calculated → hr_approved → finance_approved → approved → finalized → disbursing → paid`

There is no wizard. You open the run and press the button for the current stage.

**1. Create — "Prepare Pay Run" or "New pay run"**
Choose **Pay period**, **Pay group**, **Run type** (Regular / Off-cycle / Bonus / Adjustment), optional notes → **Create run**.
The run is created **empty**. Only one active run may exist for the same period, pay group and run type — otherwise you get "An active pay run already exists for this period, pay group and run type."

**2. Calculate — "Calculate payroll"**
Pulls approved timesheets, contracts, recurring components, loans, statutory schemes and unpaid leave, then computes gross, deductions, net and employer cost. Recalculate is allowed while the run is draft or calculated.

**3. HR sign-off — "Submit to Finance"**
Requires `payroll.review_hr` (a preparer with only `payroll.prepare` cannot do this). Blocked if the run has no employees or still has held items. Optional note to Finance.

**4. Finance review — "Approve Finance review" or "Return to HR"**
Requires `payroll.review_finance`. **Return to HR** sends the run back to `calculated` with a reason. The HR signer cannot review at this stage.

**5. Final approval — "Give final approval"**
Requires `payroll.approve`. The preparer cannot give final approval, and the final approver must differ from the finance reviewer.

**6. Finalize — "Finalize & issue payslips"**
Available at `approved` to `payroll.review_finance` or `payroll.approve`. Confirmation text: *"Finalize this run? Payslips will be issued, timesheets locked and the payroll locked against further calculation."*

Finalizing:
- issues payslips to employees,
- posts general-ledger entries,
- creates statutory remittances,
- locks the timesheet entries it consumed,
- notifies employees.

Treat this as the point of no return — **there is no cancel, reverse, unlock or delete for a pay run.**

**7. Pay it — via Payroll → Disbursements** (see §4.7).

The run page has tabs: **Employees** (expand **Lines** to see component detail), **Approvals**, **General ledger**, **Remittances**.

### 4.6 What the calculation actually does

- Base pay comes from the latest compensation change, else the contract, else the pay profile, converted to the period.
- New hires and leavers are prorated by the eligible window inside the period.
- Hours come only from **approved** timesheets submitted before the period cutoff; overtime uses the overtime multiplier and only if the group is overtime-eligible.
- Unpaid leave reduces pay by working days.
- Statutory deductions use each scheme's rate and base, with tax computed progressively across the bands and reliefs.
- Deductions are applied in priority order and capped by available pay.
- `net pay = gross − employee deductions`; employer cost adds employer contributions.

There are **no hard-coded tax or SSNIT rates** — whatever is configured is what is used. Check the statutory scheme before every run if rates changed.

### 4.7 Disbursement batches

Payroll → **Disbursements**. Only **finalized** runs can be paid.

1. **New payment batch**: choose the finalized run, payment method (bank transfer / mobile money / check / cash), pay date, notes → **Create batch**. It starts at `pending_approval`.
2. **Approve** — a different person from the creator, with `payroll.approve` or `payroll.review_finance`.
3. **Bank file** downloads the CSV. It contains full account numbers and a SHA-256 hash is recorded against the batch — store it securely and upload exactly that file to the bank.
4. **Submit** to mark the batch as processing.
5. **Mark paid** when the bank confirms, or **Failed** with a reason. Failed items can be **Retry**ed individually.
6. Batch statuses: `pending_approval → approved → processing → paid / partially_paid / failed`.

Each payment line shows a masked destination (for example "Bank ****1234"), never the full number.

### 4.8 Remittances

On the pay run page, the **Remittances** tab lists what must be sent to tax and pension authorities. **Mark paid** (requires `payroll.disburse`) records that the remittance was made. The Payroll sidebar shows **Awaiting Remittance** until these are cleared.

### 4.9 Payslips — what an employee sees

**Payslips** (`/me/payslips`) is available to every employee with `payroll.view_own`.

- Lists issued payslips only — nothing appears until the run is finalized.
- Each payslip shows gross, deductions, net and year-to-date figures, and **Print payslip**.
- **Recurring items** shows recurring earnings/deductions.
- **Bank accounts** shows the account name and last four digits only.
- Employees **cannot** edit their own pay, bank details, or components. All changes go through HR/Finance.

### 4.10 Payroll reports

Payroll → **Reports** (`payroll.reports`): summary, statutory, department cost, and overview. Use these after finalize to reconcile the ledger and remittances.

---

## 5. Who presses which button

A quick reference for a full cycle. In a small organisation one person may hold several roles, but the system will still block a person from approving their own work.

**Fund request cycle**

| Stage | Permission | Typical role |
|---|---|---|
| Create / submit | `finance.create` | Finance Manager |
| Review | `finance.review` | Finance Manager |
| Approve | `finance.approve` | Head of Finance / CEO / Director |
| Disburse | `finance.disburse` | Finance Officer / Finance Manager |
| Reconcile | `finance.reconcile` | Finance Manager |

**Payroll cycle**

| Stage | Permission | Typical role |
|---|---|---|
| Configure, set up pay | `payroll.config`, `payroll.prepare` | Head of HR |
| Create + calculate | `payroll.prepare` | HR |
| HR sign-off | `payroll.review_hr` | Head of HR |
| Finance review | `payroll.review_finance` | Finance Officer / Head of Finance |
| Final approval | `payroll.approve` | Executive Director / Head of Finance |
| Finalize | `payroll.review_finance` or `payroll.approve` | Finance |
| Payment batch | `payroll.disburse` | Finance Officer |
| Batch approval | `payroll.approve` or `payroll.review_finance` | Second approver |
| Remittances | `payroll.disburse` | Finance Officer |
| Own payslip | `payroll.view_own` | Everyone |

---

## 6. Common errors and what they mean

| Message | Meaning | Fix |
|---|---|---|
| `Permission denied: finance.approve required` | Your role lacks that permission | Ask the CEO to grant the role or a direct permission |
| `Only the CEO can …` | Protected role or permission | CEO must do it |
| `The reviewer cannot also approve the same fund request…` | Separation of duties | Use a different approver |
| `You cannot … your own …` | Self-action blocked | Another authorised person must act |
| `One or more roles…` / `Role(s) not found` | The role does not exist | Create it under Roles & Permissions |
| `This invoice has no recorded payment…` (cancel) | Cancel guard | Cancel is only for unpaid invoices |
| `Payment exceeds the outstanding balance` | Overpayment | Reduce the amount |
| `Only draft budgets can be edited` | Edit lock | Editing is limited to draft/submitted |
| `Calculate the run before submitting it` | Empty pay run | Press **Calculate payroll** first |
| `Unable to convert … to USD` | FX service unreachable | Retry later; the overview needs live rates |

---

## 7. Checklists

### Monthly finance close

1. All fund requests are **Disbursed** and **Reconciled**.
2. All expenses and reimbursements are **Paid** and **Reconciled**.
3. Reconciliation page shows zero pending.
4. Invoices issued this month have payments recorded; overdue invoices chased.
5. Financial Reports printed for the period, one per currency.
6. Budget vs Actual reviewed with budget holders.

### Payroll cycle

1. Statutory rates and tax bands checked for the period.
2. New hires have a pay profile, verified bank account and recurring components.
3. Leavers have an end date on the profile/contract.
4. Timesheets approved **before** the period cutoff.
5. Loans and one-off components added.
6. Run created → **Calculate payroll** → check the Employees tab and any held items.
7. HR **Submit to Finance** → Finance **Approve Finance review** → **Give final approval**.
8. **Finalize & issue payslips**.
9. Payment batch created → approved by a second person → **Bank file** downloaded → **Submit** → **Mark paid**.
10. **Remittances** marked paid.
11. Payroll reports reconciled against the bank statement.

---

## 8. Known gaps and rough edges

These are current limitations, not intended behaviour. Know them before launch.

1. **Drafts are often dead ends.** Fund requests, expenses, reimbursements, invoices and payments have no Edit screen and no Delete. **Save Draft** effectively strands the record.
2. **Finance Audit Trail is a placeholder** — `/finance/audit-trail` says "Coming soon". Audit data exists in the database but has no screen.
3. **Allocations do not constrain expenses.** Spend can exceed an allocation without a hard stop.
4. **Budgets, allocations, invoices and payments have no separation-of-duties guard** — unlike fund requests, expenses and payroll.
5. **No pay-run cancel or reversal.** A wrong finalized run cannot be undone; corrections must be an off-cycle adjustment run.
6. **No manual pay-run items.** Ad-hoc additions are only possible via recurring components or loans.
7. **Director can approve finance but cannot view it.** In production, `director` holds `finance.approve` without `finance.view`, so the Approvals list fails with 403. `executive_director` and `head_of_finance` currently have no finance permissions at all.
8. **Invoice "Download PDF" just opens the print dialog.**
9. **Financial reports do not convert currency** — mismatched currencies count as zero.
10. **HR can reach Employee Pay only by URL.** The sidebar hides **Employee Pay** from `payroll.review_hr`, although the route works.

---

## 9. Glossary

| Term | Meaning |
|---|---|
| **Allocation** | A slice of a budget reserved for a purpose |
| **Disbursement** | The act of releasing approved funds |
| **Fund request** | A formal request for money, with its own approval chain |
| **GL entry** | General-ledger posting created when a pay run is finalized |
| **Maker-checker** | One person creates, a different person approves |
| **Pay group** | A set of employees paid on the same schedule and rules |
| **Pay period** | The date range a pay run covers |
| **Pay run** | The calculation of pay for a period and group |
| **Payslip** | The employee-facing result of a finalized run |
| **Remittance** | Payment of statutory amounts (tax, pension) to authorities |
| **Statutory scheme** | Configured tax/social-security rule with rates and bands |
| **Reconciliation** | Confirming that paid money matches what was approved |
| **Separation of duties** | The rule that no one person controls a whole transaction |
