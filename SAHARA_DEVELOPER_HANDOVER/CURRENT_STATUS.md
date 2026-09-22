# Current Status

The authoritative, continuously-updated status log lives at the repository
root: **[`../SAHARA_OS_STATUS.md`](../SAHARA_OS_STATUS.md)**.

It's kept as a single running log (not duplicated here) because status
changes far more often than the rest of this handover folder, and having
two copies would just mean one of them silently goes stale. That file
distinguishes, for every completed piece of work:

- **CODE VERIFIED** — the code is written, typechecks, and builds.
- **DEPLOYED** — pushed to the `coolify-deploy` branch (confirmed via
  `git log origin/coolify-deploy`).
- **LIVE VERIFIED** — actually clicked through / tested against a real
  running instance (dev or production) with an authenticated session, not
  just read as code.
- **PENDING** — known not yet verified, with the specific reason why.

**When you finish a piece of work**, add an entry there rather than
claiming something is "done" only because it built successfully — this
project has repeatedly found real bugs specifically because "the code
builds" was mistaken for "the feature works," so keep that distinction
explicit for whoever reads this next.

## Snapshot as of 2026-09-22

- Core CRM (Leads/Jobs/Staff/Payments/Attendance/AMC) and the public
  booking form: complete, and the Francis (SUPERVISOR) role's access has
  been through multiple rounds of live-tested lockdown — see
  `SAHARA_OS_STATUS.md` §3.12–3.19 for the full history.
- MyBillBook API integration: removed entirely (was never configured in
  production).
- Business Data Export (Settings → Business Data Export): added, live-tested
  end-to-end against the local dev database (real ZIP generated, audit log
  entry confirmed).
- Quotations/Invoices: status workflow (Draft/Sent/Accepted/... and
  Draft/Issued/Partially Paid/Paid/Cancelled) plus list pages and a
  Quotation → Invoice conversion added; live-tested end-to-end (created a
  test invoice, generated its PDF, changed its status).
- Three PDF routes found with zero authentication and fixed — see
  `API_OVERVIEW.md`'s "general lesson" section.
- booking.*/crm.* domain split: code complete and backward-compatible
  (inert until configured); DNS + Coolify domain/SSL setup is a separate,
  owner-only action not yet done — see `DEPLOYMENT_GUIDE.md`.
- Backup/restore: already mature (S3-primary, GitHub Actions-scheduled,
  in-app restore with safety copies) before this pass; this pass added
  retention limits for `BackupEvent` rows and restore safety copies, fixed
  stale Google-Drive-as-primary documentation, and found + flagged a
  leaked backup token that had been committed in plain text in `BACKUP.md`
  (redacted; rotate it if it was ever actually used in production).
