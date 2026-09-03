# Automated Google Drive backups

A GitHub Actions workflow (`.github/workflows/backup.yml`) runs every day at
**02:00 IST** and:

1. calls `GET /api/backup` on the live app with a bearer token,
2. receives a `tar.gz` containing a consistent SQLite snapshot (`dev.db`, via
   `VACUUM INTO`) plus everything under `public/uploads/`,
3. uploads it to the Drive folder **Sahara OS Backups** as
   `sahara-os-YYYYMMDD-HHMMSS.tar.gz`,
4. deletes all but the newest **30** archives in that folder.

You can also run it on demand: repo → **Actions → Backup to Google Drive → Run
workflow**.

## One-time setup

### 1. Render env var

Set on the `SAHARA-OS` service (Environment tab):

| Key | Value |
|---|---|
| `BACKUP_TOKEN` | `2c1baf02c34169b35087adc91f16e4588a3890f5f6e4fdd086665894065f220e` |

### 2. Google Cloud — Drive API + OAuth credential

1. <https://console.cloud.google.com> → create a project (any name).
2. **APIs & Services → Library →** enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → User type **External** →
   fill the required fields → add `contact@saharacleaningservices.com` as a
   **Test user**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID →
   Web application**. Under *Authorized redirect URIs* add
   `https://developers.google.com/oauthplayground`. Save the **Client ID** and
   **Client secret**.
5. Mint a refresh token: open
   <https://developers.google.com/oauthplayground> → gear icon → tick *Use your
   own OAuth credentials* → paste the client ID/secret → in the left box enter
   the scope `https://www.googleapis.com/auth/drive` → **Authorize APIs** →
   sign in as `contact@saharacleaningservices.com` → **Exchange authorization
   code for tokens** → copy the **Refresh token**.

*(Alternative: a service-account key JSON also works as `GDRIVE_CREDENTIALS`,
but only if "Sahara OS Backups" lives on a Workspace **Shared drive**. For a
personal Drive folder, use the OAuth refresh token above.)*

### 3. Google Drive folder

Create a folder named **Sahara OS Backups** in Drive. Open it and copy the id
from the URL: `https://drive.google.com/drive/folders/<THIS_IS_THE_ID>`.

### 4. GitHub repo secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `BACKUP_URL` | `https://sahara-os.onrender.com/api/backup` |
| `BACKUP_TOKEN` | same value as the Render env var above |
| `GDRIVE_FOLDER_ID` | the folder id from step 3 |
| `GDRIVE_CREDENTIALS` | `{"client_id":"...","client_secret":"...","refresh_token":"..."}` (one line) |

Then trigger **Run workflow** once to confirm the first backup lands in Drive.

## Notes

- Retention is controlled by `KEEP_BACKUPS` in the workflow (default `30`).
- GitHub disables scheduled workflows after 60 days with no repo activity;
  a push or a manual run re-arms it.
- On Render's free plan the disk is ephemeral, so a backup only captures data
  present since the last restart. Move to a paid plan + persistent disk for
  durable data (see README).
