# Sahara OS — Developer Handover

Start here. This folder is written so that a developer with no prior context
on this project — and no access to any AI coding assistant — can clone the
repository, understand the system, run it, deploy it, and keep it running.

## Read in this order

1. **[SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md)** — what Sahara OS is, the tech
   stack, and how the pieces fit together.
2. **[USER_ROLES.md](USER_ROLES.md)** — who uses the system and what each
   role can and can't see/do.
3. **[BOOKING_FLOW.md](BOOKING_FLOW.md)** — how a customer becomes a Lead,
   a Job, and eventually an Invoice.
4. **[CRM_MODULES.md](CRM_MODULES.md)** — a tour of every internal module.
5. **[DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md)** and
   **[DATA_DICTIONARY.md](DATA_DICTIONARY.md)** — the data model.
6. **[ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)** — every
   configuration value the app reads, and what it's for.
7. **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** — how this app is actually
   deployed (Hostinger VPS + Coolify) and how to redeploy/reconfigure it.
8. **[BACKUP_RESTORE_GUIDE.md](BACKUP_RESTORE_GUIDE.md)** — disaster
   recovery: what to do when something breaks.
9. **[API_OVERVIEW.md](API_OVERVIEW.md)** — every HTTP route the app exposes
   outside of its own page navigation.
10. **[CURRENT_STATUS.md](CURRENT_STATUS.md)** — what's actually
    finished/verified vs. still pending, as of the last update.

## The one rule that matters most

**This system does not depend on Claude, ChatGPT, or any AI coding
assistant to be maintainable.** Everything in this repository — the code,
the migrations, the docs — is meant to be understood and changed by a human
developer reading plain TypeScript/SQL/Markdown. If you find a doc that only
makes sense with AI-specific context, that's a bug in the doc; fix it or
flag it.

## Quick orientation

- **Repository**: this Git repo (branch `coolify-deploy` is what's actually
  deployed to production; `main` may lag behind it — check with the owner
  before assuming which branch is current).
- **Stack**: Next.js 15 (App Router) + TypeScript, Prisma ORM over a single
  SQLite file (`better-sqlite3`), Tailwind CSS, deployed as a Docker
  container via Coolify on a Hostinger VPS.
- **No separate backend**: server logic lives in Next.js Server Actions
  (`src/server/actions/**`) and API routes (`src/app/api/**`) inside the
  same codebase as the UI.
- **Public site**: `/book` (customer booking form) and `/j/[jobNumber]`
  (booking confirmation page) require no login. Everything else requires an
  authenticated session and a role check.
