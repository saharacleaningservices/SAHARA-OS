# Deployment Guide

## Current production setup

- **Server**: a Hostinger VPS.
- **Orchestration**: Coolify (self-hosted PaaS) — builds the Docker image
  from this repo and runs it as a container.
- **Deploy trigger**: a push to the `coolify-deploy` branch fires Coolify's
  webhook, which rebuilds and redeploys automatically. There is no separate
  manual deploy step for ordinary code changes.
- **Domain(s)**: `app.saharacleaningservices.com` today; migrating to
  `booking.saharacleaningservices.com` (public) +
  `crm.saharacleaningservices.com` (internal), with the old domain kept as a
  compatibility fallback. See "Domain split" below — the DNS/Coolify side of
  this still needs the owner's action.

## Building and running locally

```bash
npm install
npm run db:setup      # creates dev.db and applies every schema change (offline-safe, no network needed)
npm run db:seed       # optional — demo data
npm run dev           # http://localhost:3000
```

Production-equivalent build:
```bash
npm run build
npm run start          # runs scripts/render-start.mjs, same as the Docker image's CMD
```

## The Dockerfile, in plain terms

Two-stage build (`Dockerfile`):
1. **Builder**: installs `python3`/`make`/`g++` (needed to compile
   `better-sqlite3`'s native addon), copies the repo, `npm ci`, `npm run build`.
2. **Runner**: same base image (Debian, not Alpine — an Alpine/glibc mismatch
   is the classic "works in build, crashes on start" failure for this native
   dependency), installs `tar` (used by the backup/restore routes) and
   `ca-certificates`, copies the built app over, runs
   `node scripts/render-start.mjs`.

## Persistent storage — the single most important deployment detail

The app stores its database at `DATABASE_URL` (default `./dev.db`, i.e.
inside the container's own filesystem) and uploaded files under
`public/uploads/`. **Unless you mount a persistent volume over one or both
of those paths**, every redeploy/restart wipes the app back to whatever's
committed in the repo's own `dev.db`.

In Coolify: add a persistent volume mounted at a path outside the app's
ephemeral filesystem (e.g. `/data`), and set `DATABASE_URL=file:/data/dev.db`.
`scripts/render-start.mjs` handles the one-time bootstrap: the very first
boot against an empty volume copies the git-committed `dev.db` onto it so
you don't start from zero; every boot after that leaves the volume alone —
from then on, the volume (not the git checkout) is the real data.

## Redeploying

Normal flow: `git push` to `coolify-deploy` → Coolify rebuilds and restarts
automatically. Nothing else to do for a typical code change.

For a schema change: make sure you followed both steps in
`SYSTEM_OVERVIEW.md`'s "How schema changes are applied" section
(`prisma/schema.prisma` AND `scripts/db-setup.mjs`) — the idempotent
`db-setup.mjs` statements run automatically on every boot via
`render-start.mjs`, no separate migration command needed on deploy.

## Domain split (booking.* / crm.* — in progress, 2026-09-22)

Code side is done (see `ENVIRONMENT_VARIABLES.md`'s `BOOKING_URL`/`CRM_URL`/
`LEGACY_APP_REDIRECT_ENABLED`, and the host-based routing in
`src/middleware.ts`) and is fully backward-compatible — it does nothing
until both env vars are set. What's still needed, and can only be done by
whoever holds DNS/Coolify access:

1. **DNS**: add `booking.saharacleaningservices.com` and
   `crm.saharacleaningservices.com` as records pointing at the same
   target the current `app.saharacleaningservices.com` points at (an A
   record to the VPS IP, or a CNAME, matching whatever the current setup
   uses).
2. **Coolify**: add both new domains to the same application (Coolify
   supports multiple domains per app) and let it provision HTTPS
   certificates for each (Coolify automates Let's Encrypt once DNS
   resolves correctly — this can take a few minutes after step 1).
3. **Verify** both new domains load correctly (booking.* should show the
   public booking page at `/`; crm.* should show the login page at `/`)
   before touching anything else.
4. **Only then**, set `BOOKING_URL` and `CRM_URL` in Coolify's environment
   variables to the two new URLs, and redeploy.
5. **Verify again** — booking links, WhatsApp message links, and the CRM
   login should all now use the new domains.
6. **Only once 3-5 are all confirmed working**, optionally set
   `LEGACY_APP_REDIRECT_ENABLED=true` to start redirecting old CRM-path
   traffic on `app.*` to `crm.*` (booking/job/gallery/legal links on the
   old domain are never redirected, so previously-shared customer links
   keep working indefinitely).

Do not skip the "verify before enabling the redirect" step — a wrong DNS/
Coolify config plus an enabled redirect could disrupt the only domain
customers currently use.

## Rolling back

Coolify keeps previous deployments; use its UI to redeploy an earlier
commit/build if a deploy causes a problem. For data-level issues (not code),
see `BACKUP_RESTORE_GUIDE.md` instead — rolling back code does not undo a
database change.
