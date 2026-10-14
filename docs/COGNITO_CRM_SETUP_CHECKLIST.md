# Cognito enquiry → Sahara OS CRM — installation & verification checklist

Status 2026-10-14: code installed in the owner's Apps Script project **"Sahara Cognito to CRM"** (property `LEAD_URL` set). **Not yet running.** Source of truth for the code: `docs/cognito-email-lead.gs` (tested by `npm run test:cognito`: 17 tests — 8 script behaviour with mocked Google services, 9 CRM intake).

## How it works
Cognito e-mails each submission to contact@saharacleaningservices.com → the Apps Script (every 5 min) reads new mails from `notifications@cognitoforms.com` → posts the parsed enquiry to `POST /api/webhook/email-lead` (Bearer token) → the CRM creates a NEW lead (or, for an open/≤24 h lead of the same number, adds a note and alerts the team) → follow-up + in-app/push alerts to Admin, Accounts, Operations. Cost: ₹0 (existing Workspace).

## What must be true for ONE real enquiry to reach the CRM
| # | Requirement | Who | Status |
|---|---|---|---|
| 1 | `EMAIL_LEAD_TOKEN` exists in Coolify (any long random value) | Owner (secret) | **Unverified** — the tools redact `*TOKEN` variables |
| 2 | Same value saved as script property `LEAD_TOKEN` | Owner (secret) | Pending |
| 3 | `LEAD_URL` = `https://crm.saharacleaningservices.com/api/webhook/email-lead` | Claude | **Done** |
| 4 | Gmail authorisation for the script (read mail, labels, send mail to owner, external requests) | Owner (Google consent) | Pending |
| 5 | Time trigger every 5 minutes | Owner (needs step 4) | Pending |
| 6 | CRM endpoint live in production | — | **Live** (401 without token, verified) |
| 7 | Optional: repeat-enquiry alert fix | Needs production push approval | Local `feat/cognito-crm-intake` |

## Owner steps (about 5 minutes)
1. Coolify → app → Environment: make sure `EMAIL_LEAD_TOKEN` exists. If not, create it (a 40+ character random value from your password manager) and **redeploy/restart the app** (Coolify asks). Keep the value; do not share it in chat.
2. script.google.com → project **Sahara Cognito to CRM** → Project Settings → Script properties → **Add** `LEAD_TOKEN` = the same value → Save.
3. **First a dry run:** add property `DRY_RUN` = `true`. In the editor choose `processCognitoEmails` → Run → Review permissions → Google shows the access list → Allow. Open *Execution log*: you will see one line per enquiry from the last 14 days ("would send enquiry (phone ending …)"). Nothing is sent, labelled or e-mailed in dry run.
4. Delete the `DRY_RUN` property (or set it to `false`). Run `processCognitoEmails` once more: it posts the enquiries (the 14-day back-fill) and labels the mails `CRM-synced`. The CRM de-duplicates by number, so people already in the CRM are not duplicated.
5. Triggers (clock icon) → Add Trigger → `processCognitoEmails` → Time-driven → Minutes timer → Every 5 minutes → Save.
6. Tell Claude. Claude verifies read-only in the CRM (Leads list) that the back-filled enquiries appear once, and then confirms the next genuinely new Cognito enquiry arrives within ~5 minutes. No fake enquiries are ever created.

## Verification (Claude, read-only)
- Gmail: threads carry `CRM-synced` (delivered) or `CRM-skipped` (no usable number); none stuck unlabelled.
- CRM → Leads: one lead per enquiring number, source "Website Form", notes "Via Cognito Form", a HIGH call follow-up, notification to Admin/Accounts/Operations.
- Repeat enquiry from the same number: note on the existing lead (+ alert once the repeat-alert fix is deployed); never a second lead.
- Failure path: if the CRM is down or the token is wrong the mail stays unlabelled, is retried every 5 min and the owner receives at most one e-mail per day.

## Rollback
Triggers → delete the trigger (stops everything). Mails labelled `CRM-synced` remain in Gmail unchanged; remove the label only if you want a re-run. Leads already created stay in the CRM (soft-delete via Trash if a test lead must go).

## Known limits
- Parsing relies on the notification layout "Name … Phone … Subject … Email … Message us …"; a different Cognito form layout would end as `CRM-skipped` (visible in Gmail), never lost.
- A retry after a CRM timeout can produce a duplicate *alert* (never a duplicate lead).
- WhatsApp copy of a Cognito lead to the team: the CRM already attempts it (TEST mode: approved test number only). Real delivery to team numbers outside the 24-hour window needs an approved utility template (≈₹0.115 per message by third-party sources; confirm Meta's rate card) and a payment method — not enabled.
