# CRM Modules

A tour of every internal module, where its code lives, and what it's for.
Cross-reference `USER_ROLES.md` for who can see each one.

| Module | Route | Server code | Notes |
|---|---|---|---|
| Dashboard | `/dashboard` | `src/server/dashboard.ts` | Role-scoped — SUPERVISOR sees today/tomorrow only; others see the full "Owner Command Center." |
| Leads / CRM | `/leads` | `src/server/leads.ts`, `src/server/actions/leads.ts` | The enquiry pipeline. `LeadStage` enum tracks NEW → ... → CONFIRMED/COMPLETED/CANCELLED. |
| Jobs | `/jobs`, `/jobs/dispatch` | `src/server/jobs.ts`, `src/server/actions/jobs.ts` | Scheduled/completed work. Team Dispatch is the same "jobs" nav section. |
| Staff | `/staff` | `src/server/actions/staff.ts` | Roster, salary (`canViewSalary`-gated), documents. |
| Vehicles | `/vehicles` | `src/server/actions/vehicles.ts` | Fleet + job assignment. |
| Attendance | `/attendance` | `src/server/actions/attendance.ts` | Daily marking, audit trail (`AttendanceAudit` — never deleted). |
| AMC Contracts | `/amc` | `src/server/actions/amc.ts` | Annual Maintenance Contracts + scheduled visits. |
| Payments | `/payments` | `src/server/actions/payments.ts` | The real money-movement ledger (`Payment` model) — advances, collections, status. |
| Expenses | `/expenses` | `src/server/actions/expenses.ts` | Chemicals/fuel/equipment/staff-advance/vendor/misc tracking. |
| **Quotations** | `/quotations` | `src/server/quotations.ts`, `src/server/actions/quotations.ts` | Added 2026-09-22. Generate from a Lead's detail page; manage status (Draft/Sent/Accepted/Rejected/Expired/Cancelled) and convert to an Invoice from the list page. |
| **Invoices** | `/invoices` | `src/server/invoices.ts`, `src/server/actions/quotations.ts` | Added 2026-09-22. Auto-created at job completion, or created manually (ad-hoc, for a customer not tied to a Job). Status: Draft/Issued/Partially Paid/Paid/Cancelled. Sahara's own — no third-party billing API. |
| Customers | `/customers` | `src/server/customers.ts` | Standalone master customer list (import/merge by mobile) — separate from the Lead/Job history, which is the primary source of "who is a customer." |
| Reports | `/reports` | `src/server/reports.ts` | Job history, before/after gallery, invoice/payment history, CSV export. |
| AI Assistant | `/assistant` | `src/lib/ai/**` | Rule-based (not an LLM by default) business-question answering — profit inputs, due payments, etc. Optional `ANTHROPIC_API_KEY` upgrades it to LLM-backed. |
| Gallery | `/admin/gallery` | `src/server/actions/gallery.ts` | Before/after marketing photos, reused on the public booking page. |
| Trash | `/admin/trash` | — | Soft-deleted records (`deletedAt` set) — restore only for OPERATIONS/ACCOUNTS, full destructive actions ADMIN-only. |
| Revenue / Profit | `/revenue`, `/profit` | `src/server/revenue.ts` | ADMIN (+ ACCOUNTS for Revenue) only. |
| Settings | `/settings` | `src/server/settings.ts`, `src/server/integrations.ts` | ADMIN-only. Company profile, integrations (WhatsApp/Maps/Backup — MyBillBook removed 2026-09-22), Business Data Export, System Recovery Backup. |
| User Management | `/admin/users` | — | ADMIN-only. |
| Audit Log | `/admin/audit-log` | `AuditLog` model | Every sensitive action writes here — check this first when investigating "who changed X." |

## Quotations & Invoices — the data model (added/completed 2026-09-22)

```
Lead ──(createQuotation)──▶ Quotation ──(convertQuotationToInvoice)──▶ Invoice
 │                                                                        ▲
 └──(confirmBooking)──▶ Job ──(on completion)───────────────────────────┘
                                                                          │
                                                                     Payment
```

- A `Quotation` belongs to exactly one `Lead`. It has its own status
  (`QuotationStatus`) independent of the Lead's stage.
- An `Invoice` can come from three places: auto-created at Job completion
  (`jobId` set), converted from an accepted Quotation (`quotationId` set),
  or created directly/manually (neither set — a "Manual" source in the
  Invoices list).
- `Invoice.status` (`InvoiceStatus`) is separate from `Payment.status` — an
  Invoice can be marked Paid manually even if no `Payment` row is linked
  (e.g. cash collected outside the system and just recorded as settled).
- GST/discount: both models carry `subTotal`, `discount`, `gstPercent`,
  `gstAmount`, `totalAmount` independently — there's no single global tax
  rate constant; each quotation/invoice sets its own GST % at creation time.
