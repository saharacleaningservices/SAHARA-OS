# Sahara OS — Developer Handover

Concise, single-file handover. For deeper detail on any topic, see the
12-file `SAHARA_DEVELOPER_HANDOVER/` folder and the root-level `BACKUP.md` /
`BACKUP_RESTORE_GUIDE.md` / `SAHARA_OS_STATUS.md` (a running, dated log of
every session's work — read it if you want the "why" behind any decision
below).

## What this is

An internal CRM + operations system for Sahara Cleaning Services (a Pune
cleaning/painting/pest-control business), plus a public customer-facing
booking form — replacing a mix of spreadsheets, WhatsApp, and a third-party
billing tool. Two audiences, one codebase: the public booking form (no
login) and the internal CRM (role-based login: ADMIN, SUPERVISOR,
OPERATIONS, ACCOUNTS — see `SAHARA_DEVELOPER_HANDOVER/USER_ROLES.md`).

## Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router, React Server Components + Server Actions |
| Language | TypeScript throughout |
| Database | SQLite (single file, `dev.db`), via Prisma ORM + `@prisma/adapter-better-sqlite3` |
| Auth | Custom — bcrypt password hashes, JWT session cookie (`jose`), no third-party provider |
| PDFs | `@react-pdf/renderer` (quotations, invoices, certificates, payslips) |
| Deployment | Docker container, built and run via Coolify on a Hostinger VPS |

Request flow: `src/middleware.ts` gates every request (auth + domain
routing) → pages under `src/app/(app)/**` are the authenticated CRM, pages
under `src/app/book`, `src/app/j`, `src/app/gallery` are public → pages
(React Server Components) call `src/server/**` directly to read data →
mutations go through `src/server/actions/**` Server Actions, each with its
own role check (never rely on the UI hiding something as the only
protection) → a few things need a real HTTP route instead (PDFs, backups,
the business export, WhatsApp webhooks) under `src/app/api/**`.

## Database

Single SQLite file (`dev.db`), schema in `prisma/schema.prisma`. **Every
schema change needs two edits, not one**: the Prisma schema itself, AND an
idempotent statement in `scripts/db-setup.mjs` (`addColumnIfMissing` /
`CREATE TABLE IF NOT EXISTS`-style) — `db-setup.mjs` is what actually runs
against the live database on every boot; Prisma's schema alone does not
migrate anything in this deployment. **SQLite rejects `DEFAULT
CURRENT_TIMESTAMP` inside `ALTER TABLE ADD COLUMN`** (only allowed in
`CREATE TABLE`) — use a literal timestamp string instead. This bug crashed
production once (2026-09-22, see `SAHARA_OS_STATUS.md` §3.21); always test
a new migration against a genuinely empty database
(`rm -f /tmp/test.db && DATABASE_URL="file:/tmp/test.db" node scripts/db-setup.mjs`),
never just against the local `dev.db`, which accumulates state and can hide
a broken migration.

## Deployment

- **Server**: Hostinger VPS. **Orchestration**: Coolify (self-hosted PaaS) —
  builds the Docker image from this repo, runs it as a container.
- **Deploy trigger**: push to the `coolify-deploy` branch → Coolify's webhook
  rebuilds and redeploys automatically. No manual deploy step for ordinary
  changes.
- **Persistent storage — the single most important deployment detail**: the
  database (`DATABASE_URL`, default `./dev.db`) and `public/uploads/` must
  be on a Coolify persistent volume (e.g. mounted at `/data`,
  `DATABASE_URL=file:/data/dev.db`), or every redeploy wipes the app back to
  whatever's committed in git. `scripts/render-start.mjs` bootstraps an
  empty volume from the committed `dev.db` on first boot only; every boot
  after that leaves the volume alone.
- **Rolling back code**: use Coolify's UI to redeploy an earlier
  commit/build. This does not undo a database change — see Restore below
  for that.
- Local dev: `npm install && npm run db:setup && npm run dev` (http://localhost:3000).
  Production-equivalent: `npm run build && npm run start`.

## Domains

- Live today: `app.saharacleaningservices.com` (single domain, both public
  booking and internal CRM).
- In progress, held at the DNS gate (owner decision pending, 2026-09-23):
  splitting into `booking.saharacleaningservices.com` (public) and
  `crm.saharacleaningservices.com` (internal). Code side is done and fully
  backward-compatible (inactive until env vars are set — see below).
  **Coolify side is now partially prepared**: both domains have been added
  to the Sahara OS application in Coolify (port 3000, HTTPS) — this is
  saved configuration only, not yet active ("Changes pending", no
  restart/redeploy triggered). `BOOKING_URL`/`CRM_URL` are still **unset**.
  `saharacleaningservices.com`'s DNS is authoritative in a cPanel account
  (Ad Agency-managed, now kept strictly read-only) — nameservers are Custom
  DNS pointing there, not Namecheap's own DNS. Namecheap's Advanced DNS
  editor is locked while Custom DNS is selected, so the only way to make
  Namecheap/Hostinger/Coolify authoritative for the two new subdomains is a
  **full nameserver cutover** (recreate all ~33 existing records — root
  `@`, `www`, 5×MX, SPF, DKIM, every cPanel service record — in Namecheap
  first, then switch nameservers), which risks live Google Workspace email
  and the separate Ad Agency website during propagation if done wrong. The
  owner was presented this and chose to defer it — see `SAHARA_OS_STATUS.md`
  §3.24, re-confirmed still blocking in §3.25. Alternative: ask the agency
  to add the two A records directly in their own cPanel (they can edit
  their own panel; this session cannot). Once DNS resolves for both: verify
  both load correctly, **then** set `BOOKING_URL`/`CRM_URL`, redeploy,
  verify again, and only then optionally set
  `LEGACY_APP_REDIRECT_ENABLED=true`. Rollback at any stage: unset
  `LEGACY_APP_REDIRECT_ENABLED` and/or `BOOKING_URL`/`CRM_URL` and redeploy
  — both fall back to the legacy host with no code change and no data risk
  (single shared database throughout).

## Environment variables (names/purpose only — see `.env.example` for the full list, never commit real values)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite path, e.g. `file:/data/dev.db` in production |
| `AUTH_SECRET` | Session JWT signing secret — changing it logs out everyone |
| `BOOKING_URL` / `CRM_URL` | Domain-split URLs (see above); unset = fully inactive |
| `LEGACY_APP_REDIRECT_ENABLED` | Only after domain split is verified working |
| `BACKUP_TOKEN` | Authorizes `GET /api/backup` for the GitHub Actions workflow |
| `CRON_TOKEN`, `MISSED_CALL_TOKEN` | Authorize internal cron/webhook routes |
| `GDRIVE_FOLDER_ID` | Drive backup folder id (display only in-app; the real credential lives in GitHub secrets, not here) |
| WhatsApp/Maps/SMS/Email/Push/Ads vars | All optional, "queue always, deliver only if configured" — nothing breaks if unset |

## Backup (see `BACKUP.md` for the full setup log)

Daily GitHub Actions workflow (`.github/workflows/backup.yml`, 02:00 IST)
downloads a verified snapshot from the live app and uploads it to **Google
Drive** (primary, confirmed working end-to-end 2026-09-22) via OAuth as the
owner's own Google account — **not** a service account (Google service
accounts have zero Drive storage quota and cannot create files even in a
folder shared to them as Editor; learned the hard way this session).
Retention: newest 30 daily + 1/month for 12 months. Weekly (Sunday) also
uploads an AES-256-encrypted copy. S3 is supported but not provisioned
(deliberately — no new paid storage). Can also be run on demand: repo →
Actions → Sahara OS Enterprise Backup → Run workflow (branch:
`coolify-deploy`).

## Restore (see `BACKUP_RESTORE_GUIDE.md` for the full walkthrough)

Owner-only, from Settings → System Recovery Backup → "Restore from Backup"
→ choose the `.tar.gz` → type `RESTORE` to confirm. The app validates the
archive, takes a timestamped safety copy of the current live database
before overwriting anything (5 most recent kept, restorable), swaps in the
files, restarts. A real production backup was downloaded and its data
verified (integrity `ok`, thousands of real records spot-checked) without
ever touching production — see `BACKUP_RESTORE_GUIDE.md`'s restore-test
table for the exact method to test safely.

## Business Data Export

Settings → Business Data Export (ADMIN-only): generates a ZIP containing
CSVs (Customers, Leads, Jobs, Quotations, Invoices, Payments, Staff,
Bookings, Service History, Attendance, AMC) plus an XLSX workbook and a
JSON copy. Includes name/mobile/alternate mobile/email/address/service
history/booking/quotation/invoice/payment data as the schema supports
(`Customer` has no email field — a real schema limitation). **Never
includes credentials, passwords, OTPs, API keys, or tokens** — only
Customer/Lead/Job/Quotation/Invoice/Payment/Staff/Attendance/AmcContract
tables are queried, never `User` or `IntegrationSettings`. Code:
`src/server/business-export.ts`. Live-verified against production
2026-09-22 (real downloaded ZIP inspected, all tables present with real
row counts, no secrets found).

## GitHub / Coolify

- Repo: `saharacleaningservices/SAHARA-OS`, deploy branch `coolify-deploy`
  (note: `origin/main` has diverged and carries some different work — not
  reconciled, a business decision, not a technical blocker).
- GitHub Actions secrets (Settings → Secrets and variables → Actions):
  `BACKUP_URL`, `BACKUP_TOKEN`, `GDRIVE_FOLDER_ID`, `GDRIVE_CREDENTIALS` are
  set; `S3_*` and `BACKUP_ENCRYPTION_KEY` are not (optional).
- Coolify manages the app container, its environment variables, domains,
  and the persistent volume. Push to `coolify-deploy` to deploy; use
  Coolify's UI to roll back a bad deploy.

## Recovery procedure (quick reference — full detail in `BACKUP_RESTORE_GUIDE.md`)

1. **App won't start / crash loop**: check Coolify's deployment logs first —
   most likely a bad migration in `scripts/db-setup.mjs` (see the SQLite
   `ALTER TABLE` caveat above). Fix and push; Coolify auto-redeploys.
2. **Data corruption/loss**: Settings → System Recovery Backup → Restore
   from Backup (owner-only, requires typed confirmation, always takes a
   safety copy first).
3. **VPS/server replacement**: provision the new server, point Coolify at
   it, deploy from GitHub (recreates code + empty DB), then restore the
   most recent Google Drive backup, then re-point DNS if the IP changed.
4. **Wrong restore**: every restore leaves a timestamped safety copy
   (`dev.db.before-restore-<timestamp>`, 5 most recent kept) — stop the app,
   copy that file back over the live `dev.db`, restart.
