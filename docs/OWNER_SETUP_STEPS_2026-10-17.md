# Owner setup steps — tokens, Cognito, Meta, Google Ads (17 Oct 2026)

Secrets are only ever typed by the owner, never pasted into chat, docs or GitHub. Only variable **names** are listed here.

## Time-sensitive
The Cognito script only reads mail from the **last 14 days**. Today it still reaches the enquiries of 7–13 Oct;
the 7 Oct mails fall out of that window around **21 Oct 2026**. Install the script before then, or those enquiries
must be entered by hand.

## A. Coolify → Sahara OS → Environment Variables (then Redeploy — NEXT_PUBLIC_* are build-time)
| Variable | Value comes from | Secret? |
|---|---|---|
| `EMAIL_LEAD_TOKEN` | any 40+ character random value (password manager); same value goes into the Apps Script | **Yes** |
| `NEXT_PUBLIC_META_PIXEL_ID` | Events Manager → dataset "Sahara Cleaning Services" **ID 2014299429231265** | No |
| `META_CAPI_TOKEN` | Events Manager → that dataset → Settings → Conversions API → Generate access token | **Yes** (never `NEXT_PUBLIC_`) |
| `META_CAPI_TEST_CODE` | Events Manager → Test events (only while testing; delete afterwards) | No |
| `NEXT_PUBLIC_GA4_ID` | already live (`G-74EZWDS33Z`) — nothing to do | No |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Google Ads account **988-668-0860** → Tools → Conversions → tag setup (looks like `AW-123456789`; the code comment shows `AW-765890204`) | No |
| `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL` | the same page: the conversion label of the "Lead form submit" action (create the action first — the account currently measures no goals) | No |
Optional hardening: `EMAIL_LEAD_HMAC_SECRET` (+ Apps Script `HMAC_SECRET`, same value, set together).

## B. Cognito → CRM (Apps Script project "Sahara Cognito to CRM"; full checklist: `docs/COGNITO_CRM_SETUP_CHECKLIST.md`)
1. Script properties: `LEAD_URL` (already set), `LEAD_TOKEN` = the value of `EMAIL_LEAD_TOKEN`, `DRY_RUN` = `true`.
2. Editor → run `processCognitoEmails` → Review permissions → Allow. Execution log lists each enquiry (phone last 4 digits only); nothing is sent or labelled.
3. Tell Claude the dry run is done → Claude reads the log summary, then you delete `DRY_RUN`, run once more (labels `CRM-synced`), add the 5-minute trigger.
4. Claude then verifies read-only: one lead per number in CRM → Leads, Gmail labels, no duplicates.

## C. GitHub
- Settings → Secrets and variables → Actions → New secret `BACKUP_ENCRYPTION_KEY` (long random value; **keep a copy in your password manager — without it encrypted backups cannot be restored**).
- PR #4 (backup alerts) is merge-safe even **before** the key exists: the workflow only warns and the Drive copy continues. The encrypted second copy starts once the key exists. Merging is blocked for Claude by the session safety guard → merge it yourself.
- PR #8 (Meta CAPI, `e69c7bc`, base `coolify-deploy` `96329cb`): merge after step A (`META_CAPI_TOKEN` + Pixel ID) so the first deploy already sends events; then Meta Test events: one lead from a **non-protected** test number must show Browser + Server, "Deduplicated".

## D. Meta / Google Ads billing (owner-only)
- Meta ad account 343079872519451: three campaigns show **Payment error** — fix the payment method or leave them off.
- Google Ads 988-668-0860: banner "Balance exhausted"; no campaign has delivered in the last 7 days; 1 user (Admin), **no linked manager** (no agency). Add a conversion action before activating "Home Cleaning Search Camapign | Pune | Feb'26" (₹620/day).
- Google Ads 995-688-3837 is the separate painting account (The Paint Master) — not part of Sahara Cleaning.

## E. SMS queue (187+ old attendance SMS)
No existing tool cancels SMS: the CRM's "Cancel stale queue" button only touches WhatsApp rows. SMS rows (`SmsMessage`, status QUEUED) are sent only when SMS gateway credentials are saved. **Do not save SMS credentials** until the old rows are cleared (needs a small admin tool — decision pending). The Message Log shows the 200 newest SMS only, so the true queued count may be higher than 187.
