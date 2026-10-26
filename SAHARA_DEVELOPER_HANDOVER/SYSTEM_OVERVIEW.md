# System Overview

## What Sahara OS is

An internal CRM + operations system for Sahara Cleaning Services (a Pune
cleaning/painting/pest-control business), plus a public customer-facing
booking form. It replaces what would otherwise be a mix of spreadsheets,
WhatsApp, and a third-party billing tool.

Two audiences, one codebase:

- **Public**: anyone can open `booking.saharacleaningservices.com` (or the
  legacy `app.saharacleaningservices.com/book`) and submit a service booking
  with no account.
- **Internal**: staff log into `crm.saharacleaningservices.com` (or the
  legacy `app.saharacleaningservices.com`) with a role-based account to
  manage leads, jobs, staff, payments, and more.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router, React Server Components + Server Actions |
| Language | TypeScript throughout |
| Database | SQLite (single file, `dev.db`), via Prisma ORM + `@prisma/adapter-better-sqlite3` |
| Styling | Tailwind CSS + shadcn/ui-style components (`src/components/ui/`) |
| Auth | Custom — bcrypt password hashes, JWT session cookie (`jose` library), no third-party auth provider |
| PDFs | `@react-pdf/renderer` (quotations, invoices, certificates, payslips) |
| Deployment | Docker container, built and run via Coolify on a Hostinger VPS |

## How a request flows

1. `src/middleware.ts` runs on every request first — checks the session
   cookie, decides if the path needs auth, and (as of 2026-09-22) can also
   branch on which domain the request came in on (see the domain-split
   section of `DEPLOYMENT_GUIDE.md`).
2. Pages under `src/app/(app)/**` are the authenticated CRM; pages under
   `src/app/book`, `src/app/j`, `src/app/gallery` etc. are public.
3. Pages are React Server Components that call functions in `src/server/**`
   directly (no fetch, no separate API layer) to read data.
4. Mutations (creating a lead, marking a job complete, etc.) go through
   Server Actions in `src/server/actions/**` — these are the only place
   writes happen, and each one does its own role/scope check (see
   `USER_ROLES.md` — **never rely on the sidebar/nav hiding something as the
   only protection; every action re-checks**).
5. A handful of things need a real HTTP route instead of a Server Action —
   file downloads (PDFs, the business data export, backups), webhooks
   (WhatsApp), and anything that needs a specific `Content-Type`. These live
   under `src/app/api/**` — see `API_OVERVIEW.md`.

## Where things live (directory map)

```
src/
  app/
    (app)/          # authenticated CRM pages (leads, jobs, staff, payments, ...)
    book/           # public booking form page
    j/[jobNumber]/  # public booking confirmation page
    api/            # HTTP routes: PDFs, exports, backups, webhooks
  components/       # React components, grouped by feature (leads/, jobs/, payments/, ui/, ...)
  server/           # data-reading functions + business logic, grouped by domain
  server/actions/   # Server Actions (all writes go through here)
  lib/              # shared utilities: constants, auth, session, validation, PDF templates, ...
  middleware.ts     # auth gate + (new) domain-split routing
prisma/
  schema.prisma     # the data model (source of truth for types)
  migrations/       # the ONE baseline migration — see "How schema changes are applied" below
scripts/
  db-setup.mjs      # applies the baseline migration + every schema change since, idempotently
  render-start.mjs  # production boot script (persistent-disk bootstrap + db-setup + seed-if-empty + start)
```

## How schema changes are applied (important — this project does NOT use `prisma migrate deploy`)

There is exactly one committed Prisma migration
(`prisma/migrations/00000000000000_init/`). Every schema change made after
that is instead added as an **idempotent statement in `scripts/db-setup.mjs`**
— either `CREATE TABLE IF NOT EXISTS ...` for a new table, or a small
`addColumnIfMissing(table, column, ddl)` helper for a new column on an
existing table (there's also a `dropColumnIfPresent`-style helper pattern
used when a column is genuinely removed — see the MyBillBook removal near
the bottom of that file for an example).

**Why**: this setup needs to work even in sandboxed environments that can't
reach Prisma's engine-download CDN, and it needs to run safely against a
real production SQLite file on every boot without a separate migration step.

**What this means for you**: if you add/change/remove a Prisma model field,
you must do BOTH:
1. Edit `prisma/schema.prisma` (so `prisma generate` produces the right
   TypeScript types), and
2. Add the matching idempotent SQL to the bottom of `scripts/db-setup.mjs`
   (so it actually gets applied to a live database on the next deploy).

Forgetting step 2 is the single most common way to "fix" something locally
that then does nothing in production.

## Authentication model

- Login is by mobile number OR email + password (`src/app/api/auth/login/route.ts`).
- Passwords are bcrypt-hashed (`src/lib/auth.ts`).
- A successful login sets a signed JWT in a cookie (`src/lib/session.ts`).
- Some roles (OPERATIONS, ACCOUNTS, SUPERVISOR) require a known-device
  approval or WhatsApp OTP before a new device gets a session — see
  `DEVICE_GATED_ROLES` in the login route.
- `middleware.ts` decodes the cookie and checks `canAccess(role, section)`
  (defined in `src/lib/constants.ts`'s `ROLE_NAV_ACCESS`) against the first
  path segment of the URL.
- **Defense in depth**: middleware is not the only gate. Individual pages
  and Server Actions also call `requireRole`/`requireUser`/scope-check
  helpers — this was added deliberately after finding several pages that
  had no page-level check at all and relied entirely on middleware (a direct
  URL or a direct Server Action call would have bypassed it). See
  `SAHARA_OS_STATUS.md` for the history of exactly which gaps were found and
  closed.
