# Automated off-site backups

A GitHub Actions workflow (`.github/workflows/backup.yml`) runs every day at
**02:00 IST** and:

1. calls `GET /api/backup` on the live app with a bearer token,
2. receives a `tar.gz` containing a consistent SQLite snapshot (`dev.db`, via
   `VACUUM INTO`) plus everything under `public/uploads/`,
3. verifies the archive (`.github/scripts/verify_backup.py`) before it's ever uploaded,
4. uploads it to **S3-compatible object storage** — the primary off-site
   destination (owner decision, 2026-09-21: "Do not use Google Drive as
   primary backup"). Works with any S3-compatible provider (Hostinger Object
   Storage, AWS S3, Backblaze B2, Wasabi, Cloudflare R2, MinIO),
5. on Sundays, additionally uploads a second, AES-256-encrypted copy (full
   weekly backup) to a separate prefix,
6. optionally also uploads to **Google Drive** — a secondary/legacy copy,
   only if Drive credentials are configured; skipped entirely otherwise,
7. applies retention in each destination it writes to (see below).

You can also run it on demand: repo → **Actions → Sahara OS Enterprise Backup
→ Run workflow**.

## One-time setup

### 1. App environment variable (Coolify)

Set on the Sahara OS application (Coolify → your app → Environment Variables),
or leave it to the app's own generated value from Settings → Integrations →
Backup, whichever you use as the source of truth:

| Key | Value |
|---|---|
| `BACKUP_TOKEN` | a long random string — generate one from Settings → Integrations → Backup → "Regenerate token", or with `openssl rand -base64 32` |

**Security note (2026-09-22):** an earlier version of this file had a real
token value printed in plain text here. If that value was ever actually used
in production, treat it as compromised and regenerate it from Settings →
Integrations → Backup → "Regenerate token" (this immediately invalidates the
old one), then update the `BACKUP_TOKEN` GitHub secret below to match.

### 2. S3-compatible storage (primary destination)

Create a bucket with any S3-compatible provider, then add these as GitHub
repo secrets (step 4):

| Secret | Value |
|---|---|
| `S3_BUCKET` | the bucket name |
| `S3_ENDPOINT_URL` | leave unset for AWS; set for any other provider (e.g. Hostinger Object Storage, Backblaze, Wasabi, R2) |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | the bucket's access credentials |
| `S3_REGION` | the bucket's region, if the provider requires one |
| `BACKUP_ENCRYPTION_KEY` | (optional) a passphrase for the weekly encrypted copy — without it, the Sunday encrypted step is skipped |

### 3. Google Drive (optional, secondary)

Only needed if you also want a copy on Google Drive, in addition to S3.

1. <https://console.cloud.google.com> → create a project (any name).
2. **APIs & Services → Library →** enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → User type **External** →
   fill the required fields → add your Google account as a **Test user**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID →
   Web application**. Under *Authorized redirect URIs* add
   `https://developers.google.com/oauthplayground`. Save the **Client ID** and
   **Client secret**.
5. Mint a refresh token: open
   <https://developers.google.com/oauthplayground> → gear icon → tick *Use your
   own OAuth credentials* → paste the client ID/secret → in the left box enter
   the scope `https://www.googleapis.com/auth/drive` → **Authorize APIs** →
   sign in → **Exchange authorization code for tokens** → copy the **Refresh
   token**.
6. Create a folder named **Sahara OS Backups** in Drive and copy its id from
   the URL: `https://drive.google.com/drive/folders/<THIS_IS_THE_ID>`.

### 4. GitHub repo secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `BACKUP_URL` | `https://<your-production-domain>/api/backup` (e.g. `https://crm.saharacleaningservices.com/api/backup` once that domain is live, or the current `app.saharacleaningservices.com` one) |
| `BACKUP_TOKEN` | the token from step 1 |
| `S3_BUCKET`, `S3_ENDPOINT_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` | from step 2 |
| `BACKUP_ENCRYPTION_KEY` | (optional) from step 2 |
| `GDRIVE_FOLDER_ID`, `GDRIVE_CREDENTIALS` | (optional) from step 3, `GDRIVE_CREDENTIALS` = `{"client_id":"...","client_secret":"...","refresh_token":"..."}` on one line |

Then trigger **Run workflow** once to confirm the first backup lands where
expected.

## Retention

- **S3 (primary) and Google Drive (optional)**: each keeps the newest 30
  daily archives, plus one archive per distinct calendar month for 12 months
  beyond that (`KEEP_DAILY`/`KEEP_MONTHLY` env vars in the workflow).
- **Weekly encrypted copies**: kept separately, newest 12.
- **`BackupEvent` rows** (shown in Settings → System Recovery Backup) and
  **pre-restore safety copies** (`dev.db.before-restore-*`, written by
  `POST /api/backup/restore` before every restore) are each pruned to the
  most recent 500 and 5 respectively by the app itself — see
  `src/app/api/backup/route.ts` and `src/app/api/backup/restore/route.ts`.
- GitHub disables scheduled workflows after 60 days with no repo activity;
  a push or a manual run re-arms it.

## Restoring

See `BACKUP_RESTORE_GUIDE.md` for the full disaster-recovery walkthrough
(application crash, database corruption, VPS failure, server replacement)
and how to safely test a restore before trusting it.
