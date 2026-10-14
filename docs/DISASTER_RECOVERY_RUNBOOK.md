# Sahara OS — Backup & Disaster Recovery Runbook

Last verified: 2026-10-14 (real-backup restore drill, CRM page test, alert design + tests). Changes in §10 are PREPARED on the working tree only - not pushed, merged or deployed. No secret values appear in this file — only variable names and where they live.

## 1. What exists and where

| Asset | Where it lives | Backed up by | Status |
|---|---|---|---|
| Source code, branches, commits | GitHub `saharacleaningservices/SAHARA-OS` (`coolify-deploy` = production, `coolify-deploy-current` = dev, `main` = backup workflows) | GitHub itself only (NOT a backup of data) | Code is reproducible from GitHub |
| Production SQLite DB | Docker volume `…-sahara-os-data` → `/app/data` on the VPS | Daily GitHub Action → `/api/backup` → Google Drive | VERIFIED |
| Uploads (logo, signatures, photos) | Docker volume `…-sahara-os-uploads` → `/app/public/uploads` | Same archive (`uploads/`) | VERIFIED (9 files, 3.1 MB restored) |
| VPS (Hostinger KVM 2, Ubuntu) | Hostinger | Hostinger weekly backup + 2 snapshots | Not restore-tested |
| Coolify config (app, domains, env values, volumes) | Coolify DB on the VPS | NOT backed up off-VPS | GAP — see §8 |
| Env variable VALUES | Coolify → app → Environment | Owner's password manager (must be kept) | Owner action |
| DNS | Domain registrar / DNS host | Zone export recommended | Not exported |
| SSL | Let's Encrypt, auto-renewed by Coolify/Traefik | Re-issued automatically after rebuild | OK (crm/booking expire 2026-12-22, app 2026-12-07) |
| Mail | Google Workspace (MX → aspmx.l.google.com) | Google | Outside the VPS |
| WhatsApp / Meta | Meta Business (WABA, templates) | Meta | Outside the VPS; tokens are owner-held |

## 2. Backup schedule, retention, protection

- **Schedule:** GitHub Actions workflow "Sahara OS Enterprise Backup" (`.github/workflows/backup.yml` on `main`), cron `30 20 * * *` UTC = **02:00 IST daily**, plus manual `workflow_dispatch`.
- **Content:** tar.gz with `dev.db` (SQLite `VACUUM INTO` consistent snapshot) and `uploads/`.
- **Retention verified in practice (2026-10-14, Drive listing):** 32 files, oldest 2026-09-30; = 30 newest (daily tier) + 2 monthly keepers (September, October). Pruning works as designed. **Caveat:** the daily tier is *count*-based (30 newest files), not day-based - on 2026-10-08 about 17 manual runs happened in one day, so today the 30-file window only reaches back ~2 weeks (to 2026-10-02). Avoid many manual test runs; the monthly tier keeps one older snapshot per month.
- **Integrity gate before upload:** `.github/scripts/verify_backup.py` runs SQLite `integrity_check` and requires ≥1 User. A failing check fails the run (nothing uploaded).
- **Destination:** Google Drive folder "Sahara OS Backups" (owner's Workspace account, OAuth). Retention: 30 daily + 12 monthly. The workflow file that actually runs (on `main`, last changed 2026-09-15) has **no weekly encrypted step at all**; the `.enc` logic exists only in an older copy on the `coolify-deploy` line, which never runs. `BACKUP_ENCRYPTION_KEY` is NOT set (GitHub repository secrets are only `BACKUP_TOKEN`, `BACKUP_URL`, `GDRIVE_CREDENTIALS`, `GDRIVE_FOLDER_ID` - names read from Settings > Secrets) and the Drive folder holds no `.enc` file. **All stored backups are plaintext `.tar.gz`.**
- **Each backup also records** a `BackupEvent` row in the DB (status, size, integrity note).
- **Access:** Drive folder is private to the owner account; `/api/backup` needs Bearer `BACKUP_TOKEN` or an Admin session.
- **Known limit:** the daily archive is plaintext (customer data) in Drive; protect the Drive account with MFA/passkey.

## 3. RPO / RTO

- **RPO (data loss at worst): up to ~24 hours** (last 02:00 IST backup). Reduce by running a manual backup before risky changes (Settings → Download Backup Now, or run the workflow manually).
- **RTO (time to be back online): estimated 1–3 hours** if the VPS is intact (redeploy + restore). **If the VPS is lost, estimated 3–6 hours**, dominated by building a new VPS + Coolify + DNS. These are estimates — the drill measured only the restore (≈1 s DB restore, app boot ≈30 s); a full new-VPS rebuild has NOT been rehearsed.

## 4. Verify a backup (any machine, never production)

```bash
# 1. download sahara-os-YYYYMMDD-HHMMSS.tar.gz from Drive to an empty folder
node scripts/restore-drill.mjs <archive.tar.gz>        # add --keep to inspect
```
Passes when it prints `"result": "RESTORABLE"`: integrity_check ok before and after migration, same table count, no rows lost, upload file count. It refuses to run if `/app/data` exists (i.e. inside production).

Last real result (2026-10-14, `sahara-os-20261014-140625.tar.gz`, 5,281,507 B): integrity ok/ok, 63 tables, 15 users, 4,225 customers, 221 leads, 243 jobs, 220 payments, 43 quotations, 22 invoices, 1,040 attendance, 9 upload files.

## 5. Restore procedures

### A. Data corruption/loss, VPS healthy
1. Take a fresh manual backup first (keep the bad state for forensics).
2. Download the latest good archive from Drive.
3. In the CRM: **Settings → System Recovery Backup** → upload the archive, type `RESTORE` (Admin only). This replaces DB + uploads.
4. Open the CRM, check leads/jobs/payments counts against §4.

### B. App container broken, data volumes intact
Coolify → application → **Redeploy** (branch `coolify-deploy`). Volumes persist; `scripts/render-start.mjs` runs `db-setup.mjs` on boot.

### C. VPS lost (full rebuild)
1. Hostinger: restore the latest weekly backup/snapshot **or** create a new Ubuntu VPS.
2. If new: install Coolify (`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`), log in, connect the GitHub App, create the app from `saharacleaningservices/SAHARA-OS`, branch `coolify-deploy`, build pack as before.
3. Add persistent storage: `/app/data` and `/app/public/uploads`.
4. Re-enter all env variables (§6) from the owner's password manager.
5. Deploy once (creates an empty DB via `db-setup.mjs`), then restore the Drive archive via procedure A (or copy `dev.db` into `/app/data/` and `uploads/*` into `/app/public/uploads/`, then redeploy).
6. DNS: point `crm`, `booking`, `app` A records to the new IP (owner approval — DNS change). Wait for Let's Encrypt issuance.
7. Re-create the GitHub secrets if the BACKUP_URL/token changed; re-run the backup workflow manually and confirm a new file in Drive.
8. Meta webhook callback URL is the CRM domain — unchanged if the domain is unchanged; re-verify in Meta only if it fails.

### D. Locked out of Coolify
On the VPS: `docker exec -it coolify php artisan root:reset-password` (or `root:change-email`).

## 6. Environment variable names (values live in Coolify + owner's password manager)

App: `DATABASE_URL` `AUTH_SECRET` `UPLOADS_DIR` `BACKUP_TOKEN` `CRON_TOKEN` `CRM_URL` `BOOKING_URL` `NEXT_PUBLIC_APP_NAME` `NEXT_PUBLIC_BUILD_ID` (derived) `SOURCE_COMMIT` (Coolify)
Messaging: `WHATSAPP_ACCESS_TOKEN` `WHATSAPP_APP_SECRET` `WHATSAPP_WEBHOOK_VERIFY_TOKEN` `WHATSAPP_PHONE_NUMBER_ID` `WHATSAPP_BUSINESS_ACCOUNT_ID` `WHATSAPP_API_VERSION` `WHATSAPP_OUTBOUND_MODE` `WHATSAPP_AI_ENABLED` `WHATSAPP_AUTO_REPLIES` `WHATSAPP_CAMPAIGNS` `WHATSAPP_USE_TEMPLATES` `WHATSAPP_BOOKING_TEMPLATE` `WHATSAPP_REVIEW_TEMPLATE` `WHATSAPP_BOOKING_CHANGE_NOTICES` `ADMIN_WHATSAPP_NUMBERS` `SMS_PROVIDER` `SMS_ENDPOINT` `SMS_API_KEY` `SMS_SENDER_ID` `EMAIL_ENDPOINT` `EMAIL_API_KEY` `EMAIL_FROM` `EMAIL_LEAD_TOKEN` `MISSED_CALL_TOKEN`
Push/Maps/Analytics: `VAPID_PUBLIC_KEY` `VAPID_PRIVATE_KEY` `VAPID_SUBJECT` `GOOGLE_MAPS_API_KEY` `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` `NEXT_PUBLIC_GA4_ID` `NEXT_PUBLIC_GOOGLE_ADS_ID` `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL` `NEXT_PUBLIC_META_PIXEL_ID` `META_DOMAIN_VERIFICATION`
Sheets/other: `LEADS_SHEET_WEBHOOK_URL` `LEADS_SHEET_WEBHOOK_SECRET` `OPS_REMINDERS_SCHEDULER` `LEGACY_APP_REDIRECT_ENABLED` `GDRIVE_FOLDER_ID`
GitHub Actions secrets: `BACKUP_URL` `BACKUP_TOKEN` `GDRIVE_CREDENTIALS` `GDRIVE_FOLDER_ID` `BACKUP_ENCRYPTION_KEY` `CRON_URL` `CRON_TOKEN` (+ optional `S3_*`, unused)

**Critical:** `AUTH_SECRET` and `VAPID_*` loss would sign everyone out / break push subscriptions; keep them in the password manager, never in GitHub or docs.

## 7. DNS / SSL dependencies (snapshot 2026-10-14)

- `crm`, `booking`, `app` .saharacleaningservices.com → A 187.53.134.175 (Hostinger VPS). `www` → 192.185.129.241 (cPanel website, separate from the CRM). MX → Google Workspace.
- Certificates: Let's Encrypt via Coolify's Traefik; needs ports 80/443 open to the internet and the A records pointing at the server.
- A new VPS IP means DNS A records must change (owner/DNS approval).

## 7b. Verified finding - Leads count (221 vs 204)
The backup holds 221 `Lead` rows; 17 have `deletedAt` set (soft-deleted). The Leads page filters `deletedAt = null`, so it correctly shows 204 (`getAllLeadsForList`, no pagination). Verified by counting the real backup read-only; no records changed. Nothing is missing.

## 8. Gaps and risks

1. **Single off-site provider** (Google Drive only). See independent-copy proposal (§9).
2. **No failure alert** on the backup workflow beyond GitHub's default email; **no in-app "backup is stale" alert**. Proposal in §10.
3. Coolify configuration and env values are not backed up anywhere off the VPS.
4. Full new-VPS rebuild not rehearsed; RTO is an estimate.
5. Weekly encrypted copy is NOT running (no `BACKUP_ENCRYPTION_KEY`). If the owner enables it, the key must also be stored offline, or encrypted backups become unreadable.
6. The running workflow (`main`) already fails if Drive credentials are missing (the upload script errors) - it does not skip silently. It does NOT verify the uploaded size, does not tell the CRM, and relies on GitHub's default failure e-mail. A latent retention bug exists in the script (an encrypted upload with KEEP_DAILY=12 would prune plaintext dailies); it never triggers today and is fixed in the prepared change.
7. Backups in Drive hold plaintext customer data; Drive account security is the only protection.
8. Coolify admin ports 8000/6001/6002 are open on the VPS (Hostinger firewall has 0 rules) — owner decision pending.

## 9. Encryption, key recovery and a second independent copy (PROPOSAL - nothing purchased or configured)

**Finding:** `BACKUP_ENCRYPTION_KEY` was never created, so every stored backup is plaintext (customer names, phones, addresses, payments). The only protection is the Google account (use MFA/passkey).

### 9a. Encryption plan (owner decision needed)
1. The OWNER generates a long random passphrase in the password manager (e.g. 32+ random characters). Claude never sees or prints it.
2. Store it in **three** places: (i) the password manager, (ii) a sealed paper copy kept physically separate from the office/VPS, (iii) GitHub secret `BACKUP_ENCRYPTION_KEY` (the owner pastes it in GitHub > Settings > Secrets). Losing all copies makes every encrypted backup permanently unreadable - there is no recovery.
3. After the key exists the Sunday workflow produces `sahara-os-*.tar.gz.enc` (AES-256-CBC, PBKDF2, round-trip verified before upload). Daily plaintext archives stay in Drive until the owner chooses to switch the daily file to encrypted as well (recommended once step 4 passes).
4. **Key-recovery drill (once, after the first .enc appears):** download it, then
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -in sahara-os-YYYYMMDD-HHMMSS.tar.gz.enc -out restored.tar.gz -pass pass:<paste key at the prompt, never in shell history>
node scripts/restore-drill.mjs restored.tar.gz
```
   (use `-pass stdin` or an environment variable so the key is not left in shell history).
5. Rotate the key yearly; keep old keys as long as old encrypted backups exist.

### 9b. Second independent destination - options
| Option | Cost | Security | Recovery |
|---|---|---|---|
| A. Second Google account, weekly encrypted copy | Rs 0 | Separate login; still Google | Easy, Drive download |
| B. Cloudflare R2 / Backblaze B2 (the workflow already has an inert S3 step) | roughly Rs 0-50/month at ~6 MB x 30 | Separate provider; needs S3 credentials as GitHub secrets; encrypt first | Easy with S3 tools |
| C. Monthly manual download to owner's PC / external disk | Rs 0 | Fully offline; depends on discipline | Direct, manual |
| D. Hostinger weekly VPS backup (exists) | included | Same provider as the VPS - not independent; restore never tested | Whole-VPS restore, slow |

**Recommendation:** B (encrypted) + C. If no spend is wanted now: A + C. Nothing is created until the owner approves.

## 10. Backup-failure alerting - PREPARED, tested in isolation, NOT deployed

Two local branches (unpushed): `feat/backup-alerts` (CRM side, based on the production line, commit after `dfa1073`) and `feat/backup-alerts-workflow` (workflow side, based on `main`, commit `957e7f1`, only `.github/` files). Full plan, evidence and rollback: `docs/BACKUP_ALERTS_ROLLOUT_PLAN.md`.

1. **Drive config check** (`gdrive_backup.py --check-config`): missing/invalid credentials fail with a clear message, no values printed.
2. **Upload size verified** against the local archive after upload.
3. **GitHub Issue alert**: a failed run opens ONE issue labelled `backup-failure` (repeat failures comment); a good run closes it. Built-in `GITHUB_TOKEN` only. Owner enabled GitHub issue notifications on 2026-10-14.
4. **CRM stale-backup alert**: the workflow POSTs `/api/backup/confirm` after a size-verified upload (`BackupEvent` status `DELIVERED`). Newest DELIVERED older than 26 h -> one critical in-app + push notification to the Super Admin (kind `BACKUP_STALE`), max once per 24 h, 08:00-22:00 IST only. Until the first confirmation ever, the newest automatic snapshot is used.
5. Weekly encrypted backup is NOT part of this change (separate owner decision, §9).

Tests (all passing, isolated scratch DB / stubs, no network): `npm run test:backup` = 10 TypeScript tests (normal, 25.9 h/26.1 h boundary, overdue, de-duplication, night window, upload-failure-with-fresh-snapshot, rollout window, recovery, confirm endpoint auth/validation); `python -I .github/scripts/test_backup_guards.py` = 16 Python tests (missing Drive credentials, invalid credentials, no secret in errors, size mismatch, retention scoping, issue open/comment/close with a stubbed `gh`). Regression: `test:ops` 7, `test:inquiry` 15, `test:eod` 16, `tsc --noEmit` clean. The real GitHub Actions run is NOT TESTED until the rollout.

## 11. Drill checklist (repeat monthly)
Download latest archive → `npm run restore:drill -- <file>` → (optional) boot with `DATABASE_URL` pointing at a *copy* under a temp folder on another port → check login and Leads/Jobs/Payments/Quotations/Invoices → delete archive + temp folder → confirm nothing is listening and no temp folder remains.
