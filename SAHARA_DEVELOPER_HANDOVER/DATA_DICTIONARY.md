# Data Dictionary

This describes the business-facing tables in customer-friendly terms — the
same ones the Business Data Export produces (Settings → Business Data
Export → Download). For the raw Prisma schema (every internal field, not
just the exported ones), see `DATABASE_STRUCTURE.md`.

The export itself regenerates a copy of this dictionary automatically every
time it runs (`Data_Dictionary.md` inside the ZIP, built by
`buildDataDictionary()` in `src/server/business-export.ts`) — that generated
copy always matches exactly what's in that specific export. This file is the
static, always-current reference kept in the repo.

## Tables

| Table | What it is | Key columns | Links to |
|---|---|---|---|
| **Customers** | The imported/master customer list | Customer ID, Name, Primary/Alternative Mobile, Address, Area | Not FK-linked to Leads/Jobs — matched by mobile number only. Most real customer history lives on Leads/Jobs directly. |
| **Leads** | Every enquiry ever entered, regardless of outcome | Lead ID, Lead Number, Mobile, Service, Stage, Quote Amount | → Bookings (subset), → Jobs (via Lead ID) |
| **Bookings** | Leads whose stage reached CONFIRMED/JOB_SCHEDULED/COMPLETED — i.e. became a real booking | Lead ID, Booking Reference, Service Date | Subset of Leads |
| **Jobs** | The operational record for a scheduled/completed service | Job ID, Job Number, Lead ID, Scheduled Date, Status, Job Value | → Payments, → Invoices |
| **Payments** | Every payment/advance/collection record | Payment ID, Invoice Number, Job ID, Lead ID, Amount, Paid Amount, Status | → Jobs, → Leads |
| **Service_History** | A simplified, human-readable view of completed Jobs only | Customer, Service, Job Number, Service Date, Job Value | Derived from Jobs — read-only summary |
| **Staff** | The employee roster, including salary/bank fields | Staff ID, Employee Code, Designation, Salary Type/Amount, Bank details | → Attendance |
| **Attendance** | One row per staff member per day marked | Attendance ID, Employee Code, Date, Status | → Staff |
| **AMC** | Annual Maintenance Contracts | AMC ID, Contract Number, Category, Frequency, Next Visit Date, Visits Logged | Optionally → Leads |

## Conventions used everywhere

- **IDs are the reliable join key, never names.** e.g. `Payments."Job ID"`
  and `Payments."Lead ID"` refer to `Jobs."Job ID"` and `Leads."Lead ID"`
  respectively. Two different customers can share a name; they can't share
  an ID.
- **Dates** are `YYYY-MM-DD`; **timestamps** are full ISO-8601 (UTC).
- **`IsDeleted` = "Y"** means the record was soft-deleted (moved to Trash)
  inside Sahara OS but is still included for completeness in an export —
  filter these out if you only want currently-active records.
- **Demo/seed data** (used for onboarding/testing inside Sahara OS) is
  always excluded from the export.
- **Blank cells** mean the field was never filled in, not zero/false.

## Adding a new table to the export

Edit `collectBusinessExportDatasets()` in `src/server/business-export.ts` —
add a Prisma query, map its rows to friendly column names (same style as the
existing mappers), and push `{ name, rows }` onto the returned array. The
XLSX/CSV/dictionary/JSON builders all consume that array generically — you
don't need to touch them.
