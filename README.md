# Sahara OS

Internal CRM / ERP for **Sahara Cleaning Services** (Pune) — lead pipeline, quotations, job scheduling, staff & attendance, payment recovery, expenses, a profit dashboard, reports, and a local rule-based AI assistant. Built with Next.js 15, TypeScript, Prisma + SQLite, and Tailwind CSS.

## Requirements

- Node.js 20+
- npm

## 1. Install dependencies

```bash
npm install
```

This also runs `prisma generate` automatically (via `postinstall`), which needs to reach Prisma's CDN once to regenerate the database client. If you're on a locked-down network and see that step fail with a 403 on `binaries.prisma.sh`, it's safe to ignore: npm installs every dependency (including compiling `better-sqlite3`'s native binding) *before* running this project's own `postinstall`, so by the time that error appears everything else has already installed correctly. This zip ships with the client already generated (`src/generated/prisma`), so just move on to `npm run dev` — don't use `npm install --ignore-scripts`, since that would also skip `better-sqlite3`'s required native build step.

The project already includes a seeded `dev.db`, so `npm install` followed by `npm run dev` is enough to get a fully working app with demo data — step 2 below is only needed if you want to reset or re-seed it.

## 2. Set up the database

The project ships with SQLite (`dev.db`) and a hand-authored SQL migration so no external services are required.

```bash
cp .env.example .env   # only if .env isn't already present
npm run db:setup       # creates tables (safe to re-run — it no-ops if they exist)
npm run db:seed        # seeds demo data: users, staff, leads, jobs, payments, expenses...
```

To start completely fresh: `npm run db:reset` (deletes `dev.db` and re-runs both steps).

`.env.example` documents the two variables the app needs — `DATABASE_URL` and `AUTH_SECRET` (used to sign session JWTs; change it before deploying anywhere real).

## 3. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

For a production build:

```bash
npm run build
npm run start
```

## Deploy to Render

`render.yaml` is a ready-to-use Render Blueprint — connect this repo in the Render dashboard (New → Blueprint) and it configures itself: build command, start command, and the `AUTH_SECRET` env var (auto-generated).

It runs `npm run start:render` instead of `npm run start`. That script (`scripts/render-start.mjs`) creates the schema if it's missing, seeds demo data only if the database is completely empty (so restarts never duplicate data), then starts the server on Render's assigned port.

The Blueprint targets the **free** plan, which has no persistent disk — anything entered after the initial seed (new leads, jobs, payments) can be lost if the service goes idle and restarts. That's fine for trying it out; for real day-to-day use, add a `disk:` block mounted somewhere like `/var/data`, point `DATABASE_URL` at it (e.g. `file:/var/data/dev.db`), and move to a paid plan that supports persistent disks.

## Seeded logins

Every seeded user has the password **`Sahara@2026`**.

| Role | Email | Name |
|---|---|---|
| Admin (full access) | admin@saharacleaningservices.com | Altaf Shaikh |
| Operations | operations@saharacleaningservices.com | Shoyab Shaikh |
| Accounts | accounts@saharacleaningservices.com | Francis D'Souza |
| Supervisor | supervisor@saharacleaningservices.com | Suresh Pawar |
| Staff | staff@saharacleaningservices.com | Vikas Shinde |

Sign in as Admin to see every module; the other roles are restricted to their relevant sections (see the access matrix in `src/lib/constants.ts`).

## What's inside

- **Dashboard** — today's leads, site visits, active jobs, pending payments, staff availability, and monthly revenue/profit trend.
- **Leads / CRM** — Kanban + table pipeline across 8 stages (New → Site Visit → Quote Sent → Negotiation → Confirmed → Job Scheduled → Completed → Paid), 6 lead sources, follow-ups, one-click Call / WhatsApp / Generate Quote / Schedule Visit.
- **Quotations** — line-item builder with GST, producing a branded, print-ready PDF (with a UPI QR code placeholder) via `@react-pdf/renderer`.
- **Jobs** — scheduling, supervisor & crew assignment, status flow (Assigned → On the Way → Started → Completed), before/after photo upload, canvas customer signature capture, and an auto-generated completion certificate + invoice on completion.
- **Staff** — 20-employee roster, attendance (present/absent/half-day/leave), daily or monthly wages, availability, and QR/GPS-ready attendance fields for a future rollout.
- **Payments** — recovery queue color-coded Paid / Due Soon / Overdue, with Call / WhatsApp / Email reminder logging and a MyBillBook invoice-number field (Phase 1 integration).
- **Expenses & Profit Dashboard** — Chemicals / Fuel / Equipment / Staff Advance / Misc. tracking, plus daily revenue, monthly profit, lead-conversion funnel and staff-utilization charts (Recharts).
- **Reports** — job history, before/after photo gallery, invoice history, payment history and certificates, with CSV export.
- **AI Assistant** — a local, deterministic rule engine (no external API calls, no data leaves the server) that drafts quotations, drafts payment reminders with escalating tone, ranks staff for a job by availability/skill/workload, narrates the day's profit, and suggests the next follow-up action per lead.

## Tech notes

- **Database**: Prisma's new TS-first `prisma-client` generator with the `driverAdapters` preview feature and `@prisma/adapter-better-sqlite3` — the app runs on the query-compiler architecture, so it needs no native Prisma engine binary. `prisma/migrations/00000000000000_init/migration.sql` is the source of truth for the schema; `scripts/db-setup.mjs` applies it directly.
- **Auth**: JWT sessions (`jose`, HS256, 7-day expiry) in an httpOnly cookie, `bcryptjs` password hashing, and role-based route protection in `src/middleware.ts`.
- **Postgres migration path**: the schema was written to be Postgres-compatible. Switching `provider = "sqlite"` to `"postgresql"` in `prisma/schema.prisma`, pointing `DATABASE_URL` at a Postgres instance, and re-running your own migration is the intended Phase 2 path.

## Project structure

```
prisma/                  Schema, hand-authored SQL migration, seed script
scripts/                 db-setup.mjs (applies the migration)
src/app/(app)/           Authenticated pages (dashboard, leads, jobs, staff, ...)
src/app/api/             Auth routes, quotation/certificate PDF routes, file upload
src/components/          UI primitives + per-module components
src/lib/                 Auth, session, validation, constants, PDF builders, AI rule engine
src/server/              Server-side data fetchers and "use server" mutations
```
