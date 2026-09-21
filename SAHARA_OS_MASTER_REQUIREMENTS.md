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

> **IMPORTANT POLICY OVERRIDE — CURRENT FINAL FRANCIS POLICY (2026-09-21)**, issued explicitly as superseding every earlier version of this requirement, including the "both roles get identical access" policy that stood earlier the same day. Where any earlier text in this document, in code comments, or in `SAHARA_OS_STATUS.md` describes Francis/SUPERVISOR as having the same access as Shoyab/OPERATIONS, **that is no longer current** — this block is the only authority for Francis's access going forward.
>
> **OPERATIONS (Shoyab) — unchanged, still full day-to-day operational access**: Dashboard, Leads/CRM, Jobs (incl. Team Dispatch), Staff, Attendance (view + operate the office clock only), Vehicles, AMC Contracts, Housekeeping, Pest Control, Interior Painting, Customers, Reports, AI Assistant, Gallery, Trash (restore only), Payments (record/edit, not owner financial settings), Expenses (add/edit operational categories, not owner financial controls). Still excluded: Profit Dashboard, User Management, Audit Log, Security/Device Approvals, Revenue Dashboard, staff salary/wage figures, WhatsApp Log, system Settings.
>
> **SUPERVISOR (Francis) — deliberately narrower, effective 2026-09-21**:
>
> **Navigation — exactly these 7 sections, nothing else**: Dashboard, Leads/CRM, Jobs (incl. Team Dispatch — shares the Jobs section), Staff, Vehicles, Attendance, plus his own Profile.
>
> **Removed/hidden/blocked, at both the nav and the server-action/API level (not just hidden in the UI)**: Payments, Expenses, Revenue Dashboard, Profit Dashboard, Reports, the standalone Customers database, User Management, Security/Settings, AMC, the Housekeeping/Pest Control/Interior Painting service views, Gallery, Trash.
>
> **Within Jobs/Leads — time-scoped, not just module-gated**:
> - TODAY and TOMORROW: view + edit allowed operational fields (`canAccessJob` in `server/jobs.ts`; the equivalent Lead scope in `server/leads.ts`).
> - PAST: view-only where legitimately needed (a lead that's an active/recent enquiry, or one whose follow-up/service date falls today/tomorrow, stays visible and editable; anything else outside that window is not reachable, including by direct URL or a direct action call).
> - Beyond tomorrow: no editable access.
> - Team Dispatch operational action and the Job Card: **today only** (stricter than the general today/tomorrow window).
>
> **Customer Actions** — may send a Booking Form link, Review link, Payment link, and Call/WhatsApp a customer, all from a Job or Lead's own detail page. Sending a Payment Link does **not** grant Payments-module or payment-record access — that stays blocked per above.
>
> **Staff** — operational field-coordination info only. Hidden completely: salary, wage, payroll, bank/payment account details, private staff documents.
>
> **Attendance** — calendar-wise Present/Absent/Leave/Weekly Off only. No salary or payroll information.
>
> **Customers** — no unrestricted database access (no global customer search/browse). Only the customer information tied to his own today/tomorrow leads/jobs is visible, through those pages directly.
>
> Implementation note: this override was verified against every place SUPERVISOR previously inherited OPERATIONS-level access — `ROLE_NAV_ACCESS`, `permissions.ts`'s fine-grained functions, every page's `requireRole` array, and every server action that mutates Jobs/Leads/Payments/Expenses/AMC/Customers data (several of which had **no role check at all** before this pass — a pre-existing gap for every role, not introduced by this change, now closed for Payments/Expenses/AMC generally and for SUPERVISOR specifically everywhere else). See `SAHARA_OS_STATUS.md` for the full list of files touched and the reasoning for each.

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
