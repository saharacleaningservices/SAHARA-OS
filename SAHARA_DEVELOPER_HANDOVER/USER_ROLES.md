# User Roles

Defined in `src/lib/constants.ts` (`ROLE_NAV_ACCESS`) and enforced in three
places for every module: navigation (what's shown), page-level (what loads),
and Server Actions (what's allowed to actually change data). See
`SYSTEM_OVERVIEW.md`'s "defense in depth" note — all three matter.

| Role | Who (as of 2026-09-22) | Summary |
|---|---|---|
| `ADMIN` | Altaf (Owner) | Full access to everything (`"*"` in `ROLE_NAV_ACCESS`) — the only role that reaches Revenue, Profit, User Management, Audit Log, Device/Security Approvals, system Settings, and the Business Data Export. |
| `OPERATIONS` | Shoyab (Operations Manager) | Full day-to-day operational access: Dashboard, Leads/CRM, Jobs (incl. Team Dispatch), Staff, Vehicles, Attendance, AMC, Payments, Expenses, Quotations, Invoices, Customers, Reports, AI Assistant, Gallery, Trash (restore only). No Revenue Dashboard, Profit, salary figures, User Management, Audit Log, security approvals, or system Settings. |
| `ACCOUNTS` | Shoaib (Accounts & Operations Editor) | Same as OPERATIONS, plus Revenue Dashboard and WhatsApp Message Log. Still no Profit, User Management, Audit Log, Device/Security Approvals, or owner-only Settings. |
| `SUPERVISOR` | Francis (Field Coordinator) | Deliberately the narrowest role — see below. |
| `STAFF` | Field crew | Mobile-only: Dashboard, Jobs (their own assigned jobs), Attendance, Profile. |

## SUPERVISOR (Francis) — the narrowest, most-audited role

This role's access has been tightened multiple times after live testing
found gaps (full history in `SAHARA_OS_STATUS.md`, sections 3.12 through
3.19). The **current, final policy**:

**Allowed sections** (top-level nav): Dashboard, Leads/CRM, Jobs (incl. Team
Dispatch), Staff, Vehicles, Attendance, Profile. That's it — no Payments,
Expenses, Quotations, Invoices, AMC, Customers (standalone database),
Reports, AI Assistant, Gallery, Trash, or any Settings/Admin page.

**Within the allowed sections, further restrictions apply**:
- **Leads/Jobs**: only today + tomorrow are editable (see `canAccessJob` in
  `src/server/jobs.ts` and `canAccessLead` in `src/server/leads.ts`) —
  leads/jobs outside that window are not shown in list views and direct-URL
  access to one is blocked at the page level too, not just hidden from the
  list.
- **Team Dispatch**: today only (stricter than the general Jobs window).
- **Dashboard**: shows only today/tomorrow operational counts — no global
  revenue/profit/monthly totals/overdue-follow-up counts.
- **Staff**: no salary, wage, bank account, GPay number, or private
  documents — `canViewSalary` in `src/lib/permissions.ts` gates all of it,
  and the same gate hides the "Edit" dialog's financial defaultValues.
- **Attendance**: kept, but never shows salary/wage/payment amounts (his own
  or anyone else's).
- **Customer actions** from within an allowed Lead/Job: Call, WhatsApp,
  sharing a Booking Form/Review/Payment link are all still allowed — sharing
  a payment link is not the same as having Payments-module access.

**When adding a new module or feature**: if it touches money, historical
data across all customers, or anything ADMIN/ACCOUNTS/OPERATIONS-only
already covers, default to excluding SUPERVISOR from it — this is what was
done for Quotations/Invoices when they were added (2026-09-22). Don't modify
this role's existing behavior without the owner's explicit instruction; when
in doubt, ask rather than guess which way a new gap should be closed.

## Where to look when adding a new protected feature

1. Add the section string to `ROLE_NAV_ACCESS` in `src/lib/constants.ts` for
   every role that should see it.
2. Add the same section string + icon to `NAV_ITEMS` in
   `src/components/layout/nav-config.tsx` — the sidebar renders this list
   filtered by `canAccess()` automatically; you don't need to touch the
   sidebar component itself.
3. Add a page-level `await requireRole([...])` (from `src/lib/current-user.ts`)
   at the top of the page — don't rely on middleware alone.
4. Add the same role check inside every Server Action the feature calls.
5. If a role should only reach specific records (not the whole module), add
   a scope-check function mirroring `canAccessLead`/`canAccessJob` rather
   than inventing a new pattern.
