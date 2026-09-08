# Integrations — "Connect Later"

Every third-party integration in Sahara OS is a **clean connector**: the app
works fully without it (queue-safe / graceful fallback), and it activates
automatically the moment you paste its credentials in
**Settings → Integrations** (`/settings`, Admin only). No redeploy needed.

Credentials are stored in the `IntegrationSettings` row (one row, id
`default`). Secrets (`whatsappAccessToken`, `backupToken`) are encrypted at
rest with AES‑256‑GCM keyed off `AUTH_SECRET` (`src/lib/crypto.ts`).
Resolution order for every integration: **Settings row first, then the
matching environment variable** (`src/server/integrations.ts`).

---

## 1. WhatsApp Cloud API (Meta)

| Field | Where to get it |
|---|---|
| Access Token | Meta Business Manager → WhatsApp → API Setup (use a permanent System User token, not the 24h test token) |
| Phone Number ID | same page |
| WhatsApp Business Account ID | optional |
| API Version | defaults to `v21.0` |

**Fallback while not connected:** every message is written to
`WhatsAppMessage` with status `QUEUED` and shown in **Admin → WhatsApp Log**.
Nothing is lost.

**On save:** `flushWhatsAppQueue()` runs immediately — the entire backlog
(and previously `FAILED` messages) is sent. Use **Send test message** to
verify; it messages the admin's own number (`User.phone`).

**Env-var equivalent:** `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_API_VERSION`, `WHATSAPP_BUSINESS_ACCOUNT_ID`.

> Note: the Cloud API cannot post into a phone WhatsApp group. Team dispatch
> is sent 1:1 to each assigned staff member. Outside a customer's 24h window
> a pre-approved template is required — free-form sends are logged as
> `FAILED` with Meta's message until templates are approved.

---

## 2. Google Maps

One key powers **Use Current Location** + **Pin on Map** in the booking form,
lead form and job card, plus the inline map preview. **Paste Maps Link**
works with no key at all.

**Google Cloud setup:**
1. Enable **Maps JavaScript API**, **Maps Embed API**, **Geocoding API**.
2. Create an API key, restrict it by **HTTP referrer** to
   `app.saharacleaningservices.com/*` (and `localhost:3000/*` for dev).
3. Paste it in Settings → Integrations → Google Maps → **Save**, then **Test key**.

**Env-var equivalent:** `GOOGLE_MAPS_API_KEY` (or
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`).

---

## 3. Google Drive nightly off-site backup

Local volume backups already run daily on the VPS (Coolify → Backups). This
adds a nightly copy to Google Drive via **`.github/workflows/backup.yml`**.
The Drive OAuth credentials live in **GitHub repo secrets** because the
upload runs inside GitHub Actions, not this server.

**GitHub → repo → Settings → Secrets and variables → Actions:**

| Secret | Value |
|---|---|
| `BACKUP_URL` | `https://app.saharacleaningservices.com/api/backup` |
| `BACKUP_TOKEN` | the token shown in Settings → Integrations → Backup (Reveal & copy) |
| `GDRIVE_FOLDER_ID` | the Drive folder ID (also paste it in Settings so both match) |
| `GDRIVE_CREDENTIALS` | Google OAuth refresh-token JSON — see `BACKUP.md` |

`GET /api/backup` accepts the `BACKUP_TOKEN` from the Settings row **or** the
`BACKUP_TOKEN` env var **or** a logged-in Admin session (the in-app
"Download Backup Now" button).

**Verify backup pipeline** in Settings runs a `VACUUM INTO` snapshot +
integrity check without downloading anything, and records a `BackupEvent`.
