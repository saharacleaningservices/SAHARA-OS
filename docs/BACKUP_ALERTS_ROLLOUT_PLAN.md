# Backup alerts — rollout plan (FOR OWNER REVIEW — nothing below has been done)

Prepared 2026-10-14. No push, merge, deploy, secret change or production change has been made. Each stage needs the owner's explicit "go".

## 0. What is being rolled out

| Part | Branch (local, unpushed) | Goes to | Contents |
|---|---|---|---|
| CRM side | `feat/backup-alerts` | `coolify-deploy` (production, fast-forward — verified: `origin/coolify-deploy` is an ancestor) | `POST /api/backup/confirm`, stale-backup check (26 h), `BACKUP_STALE` notification kind, scheduler hook, tests, runbook, restore-drill script (`754deaf`, already in history, inert) |
| Workflow side | `feat/backup-alerts-workflow` (commit `957e7f1`, based on current `main` `595d9b3`) | `main` (only after the manual test below) | `.github/` only: `backup.yml`, `gdrive_backup.py`, `backup_alert.sh`, `test_backup_guards.py` |

No database/schema change. No env-variable change. No secret change. No Coolify setting change.

**Important correction found during review:** the workflow that really runs is the one on `main` (last changed 2026-09-15). The copy on the `coolify-deploy` line is older/different and never runs. My first commit had edited that wrong copy; it is now reverted from the CRM branch and rebuilt on top of `main`'s real file. Also: the real workflow already fails (not skips) when Drive credentials are missing, so the "silent skip" risk I reported earlier applied only to the unused copy.

## 1. Diff review result

- **Secrets:** none. Only obviously fake test strings (`SUPER-SECRET-REFRESH`, `unit-test-token-not-real`, `not-a-real-token`, dummy `x/y/z` OAuth fields). No real token, key, ID or password. Secret *names* only.
- **Unrelated changes:** none. Not included: `dev.db`, `.claude/launch.json`, marketing images, generated Prisma files, `CLAUDE.md`, the master-context docx, `WHATSAPP_CAMPAIGN_REVIEW.md`, `audits/`.
- **Behaviour change in production code:** (1) every 60 s the existing scheduler also runs one cheap read query on `BackupEvent`; (2) a new public-but-token-protected route `POST /api/backup/confirm` (401 without the exact backup token; strict file-name/size validation; only writes one `BackupEvent` row); (3) one new notification kind for the Super Admin only.
- **Deployment risks (and mitigation):**
  1. *Alert right after deploy:* if no automatic backup exists in the last 26 h and it is 08:00–22:00 IST, the Super Admin gets one alert. Mitigated by taking Backup A first (stage 1). If it fires, it is correct, not a bug.
  2. *Route reachable on other hosts:* it is protected by the bearer token, same as `/api/backup`.
  3. *Confirm step before CRM deploy:* the workflow step is non-fatal, so wrong rollout order cannot fail a good backup.
  4. *Workflow permissions:* adds `issues: write` for the built-in `GITHUB_TOKEN` only (to open/close the failure issue).

## 2. Stages

### Stage 1 — Pre-deployment backup (Backup A) — uses the CURRENT workflow, nothing changed yet
1. Owner: GitHub → Actions → "Sahara OS Enterprise Backup" → **Run workflow** (branch `main`).
2. Expected success evidence: run green; step summary "Backup succeeded"; a new `sahara-os-<date>-<time>.tar.gz` (~5.3 MB) in Drive "Sahara OS Backups"; new `AUTO`/`SUCCESS` row in the CRM backup history.
3. Claude (after owner OK to download one file): `npm run restore:drill -- <file>` → expect `RESTORABLE`, integrity ok/ok, counts ≥ the 14 Oct figures (15 users, 221 leads, …), then delete the downloaded copy.
4. **Do not continue unless Backup A is green and restorable.**
- Failure meaning: red run → read the failed step; do not deploy until fixed.

### Stage 2 — Deploy the CRM change (production — needs explicit approval)
1. Owner approves; Claude pushes `feat/backup-alerts` to `coolify-deploy` as a **fast-forward** (never force). Coolify auto-builds.
2. Expected success evidence (Claude checks read-only): Coolify deployment "Finished"/healthy; `https://crm.saharacleaningservices.com/login` → 200; unauthenticated `GET /api/backup` → 401 and unauthenticated `POST /api/backup/confirm` → **401** (a 404 would mean the new code is not live); no new errors in the app log; CRM dashboard loads for the owner; no `BACKUP_STALE` notification (Backup A is fresh).
3. Expected failure signs: build fails (nothing is replaced, old version keeps running); 500s on login (roll back).
- **Rollback (no data impact, no schema change):** Coolify → application → Deployments → redeploy the previous deployment (commit `f81fbdb`); or push a revert commit to `coolify-deploy` (no force-push, no history rewrite). Any `DELIVERED` rows left behind are inert.

### Stage 3 — Test the new workflow WITHOUT touching `main`
1. Owner approves; Claude pushes the **new branch** `feat/backup-alerts-workflow` (not `main`). Pushing it runs nothing (the workflow only triggers on schedule/manual).
2. Owner: Actions → "Sahara OS Enterprise Backup" → Run workflow → **Use workflow from: `feat/backup-alerts-workflow`**. This executes the new file against the real, working secrets. It performs one normal backup (the same read-only snapshot as every night).
3. Expected success evidence: all steps green, including "Require Google Drive delivery configuration", the log line `Uploaded and size-verified sahara-os-… (… bytes …)` with the same byte size as the archive, and "Confirm delivery to the CRM" green; a new file in Drive; a new `DELIVERED` row in the CRM (`Delivered to Google Drive and size-verified`); no GitHub Issue created; step summary "Backup succeeded".
4. Failure meanings: *Require…configuration red* → a Drive secret is missing/malformed; *size mismatch* → upload truncated, re-run; *Confirm step annotated (yellow) with 404* → Stage 2 not live; *401* → `BACKUP_TOKEN` mismatch; *any red step* → a "Backup FAILED" issue is opened (that is the alert working — it closes itself after the next green run).
- **Rollback:** nothing to roll back — `main` is unchanged; delete the branch. The extra Drive file is a normal backup and ages out under the 30-daily/12-monthly retention.

### Stage 4 (optional, own approval) — prove the alert e-mail really arrives
Push a throwaway branch where the download step is forced to fail, run it once manually. Expected: a "Backup FAILED – <date>" issue appears and an e-mail reaches the owner (notifications enabled 2026-10-14); then re-run Stage 3's green workflow and watch the issue close itself. This exercises the only part unit tests cannot (GitHub e-mail delivery). Delete the throwaway branch afterwards.

### Stage 5 — Put the workflow on `main` (production backup line — needs explicit approval)
Merge `feat/backup-alerts-workflow` into `main` as a fast-forward (it is one commit on top of `main`; no force-push). Evidence: next scheduled run at 02:00 IST (20:30 UTC) is green, a `DELIVERED` row appears around 02:05 IST, no issue, no stale alert. **Rollback:** `git revert` the commit on `main` (a normal new commit); the previous workflow resumes the next night.

### Stage 6 — Morning verification (Claude, read-only)
Check the 02:00 IST run, the Drive file (size), the `DELIVERED` row, absence of any `BACKUP_STALE`/issue; update the runbook to VERIFIED.

## 3. Not in this rollout (separate pending owner decisions)
- Encryption of backups / `BACKUP_ENCRYPTION_KEY` and key-recovery plan — runbook §9a.
- Second independent off-site copy (A/B/C/D options, cost/security/recovery) — runbook §9b.
- Other non-critical items: `CRON_URL`/`CRON_TOKEN` reminders workflow, Coolify config backup, exposed Coolify ports, new-VPS rebuild rehearsal.

## 4. Status after review
- Local commits ready for review: `feat/backup-alerts` (CRM), `feat/backup-alerts-workflow` `957e7f1` (workflow).
- Tests passing: `npm run test:backup` (10), `python -I .github/scripts/test_backup_guards.py` (16), `test:ops` 7, `test:inquiry` 15, `test:eod` 16, `tsc --noEmit` clean.
- End-to-end GitHub Actions behaviour: **NOT TESTED until Stage 3.**

## 5. Stage 1 result (2026-10-14) — VERIFIED
- Run #86 of the existing workflow on `main` (`595d9b3`), started manually in the authorized browser: **Success**, 29 s; summary "Backup succeeded — sahara-os-20261014-174048.tar.gz verified and uploaded to Google Drive".
- Drive file present: 5,301,551 bytes; the downloaded copy had the same size.
- Isolated restore (`restore:drill`): RESTORABLE; `integrity_check` ok before and after migration; 63 tables; 15 users, 4,231 customers, 227 leads, 247 jobs, 224 payments, 47 quotations, 23 invoices; 9 upload files (3,146,088 B). Downloaded archive and temp folders deleted afterwards.
- Pre-deploy checks: `tsc --noEmit` clean, `npm run build` succeeds, `test:backup` 10/10.
- Baseline before Stage 2: `crm` `/login` 200, `GET /api/backup` 401, `POST /api/backup/confirm` 404 (new code not live).
- Watch item: GitHub warns `ubuntu-latest` moves to Ubuntu 26 on 2026-10-19 (Python 3.12 is pinned); re-check the run after that date.
- **Stage 2 / Stage 3 pushes were not made**: the tool's permission layer denied them (production-deploy rule). Pending explicit permission.
