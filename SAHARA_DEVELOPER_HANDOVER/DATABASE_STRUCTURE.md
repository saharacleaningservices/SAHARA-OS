# Database Structure

Single SQLite database, schema defined in `prisma/schema.prisma` (the source
of truth for TypeScript types via `prisma generate`). See
`SYSTEM_OVERVIEW.md`'s "How schema changes are applied" section before
changing anything here — this project does not use `prisma migrate deploy`.

## Core business models and how they relate

```
Lead ──┬──▶ Quotation ──▶ Invoice
       ├──▶ Job ──┬──▶ Payment ──▶ Invoice
       │          ├──▶ JobAssignment ──▶ Staff
       │          ├──▶ Photo / JobVideo
       │          ├──▶ Certificate
       │          └──▶ Expense
       ├──▶ FollowUp
       ├──▶ TimelineEntry   (permanent activity log per Lead)
       └──▶ AmcContract ──▶ AmcVisit

Customer            (standalone master list, keyed by mobile — not FK-linked to Lead/Job)
Staff ──┬──▶ Attendance ──▶ AttendanceAudit
        ├──▶ Advance / FineRecord / RewardRecord
        └──▶ JobAssignment

User (login accounts) ──▶ role (ADMIN/OPERATIONS/ACCOUNTS/SUPERVISOR/STAFF)
IntegrationSettings  (single row, id="default" — WhatsApp/Maps/Backup/SMS/WebPush config)
CompanySettings      (single row — name/logo/GST/UPI/bank details used across PDFs and the public site)
BackupEvent          (every backup/restore attempt, success or failure)
AuditLog             (every sensitive action, across every module)
```

## Soft delete

`Lead`, `Job`, `Staff`, `Payment`, `Expense` (and a few others) share the
same pattern: `deletedAt: DateTime?`, `deletedByName: String?`. A non-null
`deletedAt` means "in Trash," not physically removed. Most list queries
filter `deletedAt: null`; the Business Data Export (see `DATA_DICTIONARY.md`)
deliberately includes soft-deleted rows with an `IsDeleted` flag instead of
silently dropping them.

## Demo data

The same set of models also have `isDemo: Boolean @default(false)`. Seed
data (`prisma/seed.ts`) is marked `isDemo: true` so it's easy to tell apart
from real business data, and the Business Data Export always excludes it.

## Key enums (see `prisma/schema.prisma` for the full, current list)

| Enum | Values |
|---|---|
| `LeadStage` | NEW, INTERESTED, SITE_VISIT, QUOTATION, NEGOTIATION, CONFIRMED, JOB_SCHEDULED, CANCELLED, COMPLETED |
| `JobStatus` | PENDING, ASSIGNED, ON_THE_WAY, STARTED, COMPLETED, ... (check schema for the exhaustive list) |
| `PaymentStatus` | PENDING, DUE_SOON, OVERDUE, PAID |
| `QuotationStatus` | DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, CANCELLED (added 2026-09-22) |
| `InvoiceStatus` | DRAFT, ISSUED, PARTIALLY_PAID, PAID, CANCELLED (added 2026-09-22) |
| `AmcStatus` | ACTIVE, EXPIRED, CANCELLED |

## Inspecting the schema directly

Fastest way to check what a table actually looks like on disk (schema.prisma
can drift slightly from reality since some historical columns were added
only via `scripts/db-setup.mjs`, not always mirrored):

```bash
node -e "const D=require('better-sqlite3'); const db=new D('./dev.db',{readonly:true}); console.log(db.prepare('PRAGMA table_info(\"TableName\")').all())"
```

See `DATA_DICTIONARY.md` for the business-meaning of each exported table's
columns (customer-facing naming, not the raw Prisma field names).
