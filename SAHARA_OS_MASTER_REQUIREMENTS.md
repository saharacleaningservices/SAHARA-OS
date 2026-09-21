# Sahara OS — Master Requirements

_Authoritative baseline as given by the business owner on 2026-09-21. This supersedes any earlier version of this file. See [SAHARA_OS_STATUS.md](SAHARA_OS_STATUS.md) for the current build-vs-spec audit — this file states the "what," that one states the "how far."_

## Ground-truth context (verified against the codebase, not part of the spec itself)

- **Codebase**: `origin/coolify-deploy` (local branch `coolify-deploy-current`) is where this work lives — it is a separate line of history from `origin/main`, which is what's currently live on Render and lacks all of it. See STATUS.md §0 before assuming anything here is deployed.
- **Role mapping — CORRECTED 2026-09-21, supersedes every earlier version of this line.** Requirements #1/#2 below were originally written against an incorrect name↔role assumption ("Shoaib = ACCOUNTS", "Francis = OPERATIONS"). The owner has since confirmed the actual mapping directly, matching the original seed migration (`scripts/db-setup.mjs`, `V11_MOBILE_AUTH`) and the real staff-assignment list observed in production (`Altaf Shaikh (ADMIN)`, `Francis Monteiro (SUPERVISOR)`, `Shoyab Kazi (OPERATIONS)`):
  - **Altaf = ADMIN** (owner / Super Admin) — unchanged.
  - **Shoyab = OPERATIONS role** ("Shoaib" elsewhere in this document/history is the same person, alternate spelling — not a separate ACCOUNTS-role user).
  - **Francis = SUPERVISOR role** ("Field Coordinator"), not OPERATIONS.
  - The **ACCOUNTS** role exists in the codebase's permission architecture but is not currently assigned to any real production user as far as this session has observed — requirement #1 below (originally "Shoaib/ACCOUNTS") describes the ACCOUNTS role's capabilities, which remain implemented and available for whoever is assigned that role in the future; it does not describe Shoyab, who holds OPERATIONS.
  - Everywhere below (and in `SAHARA_OS_STATUS.md`) that says "Francis (OPERATIONS)" from before 2026-09-21's correction actually governed the OPERATIONS role — which the owner has since confirmed is Shoyab's role, not Francis's. The *role's* permissions were implemented correctly throughout; only the name attached to that role in comments/docs was wrong. Francis (SUPERVISOR) did already have Attendance from the SUPERVISOR role's original access list, independent of that mix-up.

## Rules

- Do not invent or add features that are not listed here.
- Preserve all already-working and already-verified functionality.
- Do not rebuild completed features unless a real defect is found.
- QR-code generation, QR scanning, and QR backfill are **not** approved requirements — do not build them.
- Do not deploy until current changes are verified.
- Minimize token usage; avoid rereading the entire historical conversation.
- Verify completion against the current codebase before marking anything complete.
- Only mark an item **COMPLETE** after live verification (code-complete ≠ complete).

## Already verified / completed (per the owner)

- Booking Form and dynamic quantity/pricing behavior
- Core Shoaib/Francis RBAC architecture
- Forgot Password + Owner OTP approval/password reset flow
- Mobile navigation parity
- Existing core CRM/dashboard functionality

## Remaining requirements

### 1. Shoaib (ACCOUNTS) — full operational CRM
Nav access + working edit capability for: Dashboard, Leads/CRM, Jobs, Team Dispatch, Staff, Vehicles, Attendance, AMC Contracts, Payments, Expenses, Housekeeping, Pest Control, Interior Painting, Revenue Dashboard, Customers, Reports, AI Assistant, Gallery, Trash.

Operational edit capabilities required: add/edit/update/remove staff; attendance calendar/date-wise marking; in/out attendance entries; lead add/edit/update/follow-up/status; customer data entry/update; job editing and operational updates; team dispatch and assignment.

### 2. OPERATIONS role (Shoyab) and SUPERVISOR role (Francis)

> **SUPERSEDED 2026-09-21 (owner's final role policy)** — replaces every earlier version of this requirement, including the "Attendance moved from must-not-receive to needs" amendment (which is now subsumed by the broader grant below) and the original "must not receive Payments/Expenses" restriction (explicitly reversed by the owner after being flagged as a conflict — see `SAHARA_OS_STATUS.md` for the flag-and-confirm exchange).
>
> **Both OPERATIONS (Shoyab) and SUPERVISOR (Francis) get identical, full day-to-day operational access**:
> Dashboard, Leads/CRM, Jobs (incl. Team Dispatch), Staff, Attendance (view + operate the office clock only — calendar correction/backfill/bulk/month-close stays Admin+Accounts-only), Vehicles, AMC Contracts, Housekeeping, Pest Control, Interior Painting, Customers, Reports, AI Assistant, Gallery, Trash (**restore only** — never permanent/bulk delete), Payments (**record/edit payment records and update collection status** — not owner financial settings), Expenses (**add/edit operational expense categories**: fuel, auto/cab fare, equipment, staff advance, vendor payment, miscellaneous — not owner financial controls).
>
> Must **still not** receive: Profit Dashboard, User Management, Audit Log, Security/Device Approvals, Revenue Dashboard, staff salary/wage figures, WhatsApp Log, system Settings, or any other owner-only financial/security function. Permanent/bulk delete (`canManageDataSafety`) stays Admin-only; restoring an individual record from Trash is a separate, less sensitive capability (`canRestoreRecords`) both roles now have.
>
> The SUPERVISOR role's job-list scope itself (today/tomorrow only, see `jobScopeFor`) is unchanged by this — this requirement widened *which modules/features* both roles can use, not *how many jobs* they see.

### 3. Leads / CRM
Complete the enquiry-to-conversion workflow: Inquiry → Call → Quotation → Follow-up → Conversion → Job → Payment → Review.

Required: store/update customer phone and lead details; quotation follow-up tracking; follow-up date/time; lead status; lost/converted handling; repeat-customer flag; customer conversion; follow-up reminders/notifications; stale-lead identification.

### 4. Customers
Implement/verify: add customer; edit/update customer; customer history; repeat-customer identification; link customer with leads/jobs/payments where supported by the current architecture.

### 5. Jobs
Complete job management: edit/update job details (date/time, customer, team assignment, status); operational workflow.

### 6. Team Dispatch
Assign team/staff to jobs; dispatch workflow; route/open-route workflow where already supported; status updates; live operational verification.

### 7. Payments / Billing
Complete flow: Quotation → Invoice → Payment → Pending Amount → Follow-up → Closure.

Required: payment status; pending amount; payment follow-up; invoice closure/status; preserve existing billing logic.

### 8. Shoaib — daily reporting
Daily report capturing: previous day's jobs; completed jobs; new enquiries; converted leads; follow-ups pending; payments received; pending payments; reviews received; quotations pending/follow-up.

### 9. Shoaib — monthly reporting
Monthly management report: Total Sales; Total Expenses; Employee Salaries; Vendor Payments; Miscellaneous/Other Expenses; Total Expenses; difference between Sales and Expenses. Should support MyBillBook-exported sales/purchase/expense data as a source/reference where applicable.

### 10. Google Reviews
Check Google reviews workflow; identify new reviews; identify review replies pending; maintain a review response workflow; surface review-related follow-up in CRM where supported.

### 11. Repeat customer + CRM notifications
Notifications for: new lead; follow-up due; stale lead; payment pending; job update; repeat customer.

### 12. Mobile optimisation
Shoaib's and Francis's mobile CRM must provide working access to their permitted modules with: responsive dashboard; navigation; forms; tables/cards; edit/update actions; Jobs; CRM; Dispatch; Staff functions.

### 13. Reports
Complete operational reporting suite according to role permissions. Owner-only financial/security information must remain restricted.

### 14. Backup / Restore / History
Backup; restore; backup history; preserve production data; avoid destructive operations without appropriate confirmation.

### 15. Owner-only controls
Keep restricted to Owner/Super Admin: Profit; User Management; Audit Log; WhatsApp Log; Security/Device Approval; sensitive Settings; other owner-level financial/security controls.

## Execution rule

For each requirement: inspect → implement → test → build → commit → deploy → live verify.

Only mark an item **COMPLETE** after live verification. Update [SAHARA_OS_STATUS.md](SAHARA_OS_STATUS.md) after each completed item.
