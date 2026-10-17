# Sahara OS — session handover (latest first)

Read this and `docs/MASTER_TASK_REGISTER.md` (bottom = newest) before starting a new chat. No secrets or customer PII here.

## 2026-10-17 (night)

- WebBrand audit report sent (msg 1a149096f0d1f662) after SSL mail (1a148fbf1bac8ce5); no reply/bounce yet. Details: docs/WEBBRAND_WEBSITE_SEO_SSL_AUDIT.md.
- Branch fix/housekeeping-og (c5cd19d): Open Graph fix for /housekeeping-services, test:og, build OK; not merged.
- Read-only findings: Meta dataset 2014299429231265 has received no events; Google Ads 988-668-0860 shows no conversion data and its Access page was blocked by a Chrome ad-blocker banner; GBP has 2 verified Sahara profiles with different addresses; Drive has daily backup archives through 17 Oct 04:24 IST (restore into isolated copy still not done).
- Resume first: check Gmail for WebBrand reply/bounce; then Cognito DRY_RUN once owner installs script + sets EMAIL_LEAD_TOKEN; then PR #8 live dedup test after owner merges and sets Meta env. Model: Sonnet.

## 2026-10-17 (evening)

**Changed this session**
- PR #8 `feat/meta-capi` → `coolify-deploy`, head `e69c7bc`: Meta CAPI relay + shared `event_id` + protected-number
  suppression. Local: test:capi 9/9, leadtrack 2/2, domains 4/4, cognito 25/25, tsc + eslint exit 0, `next build` OK.
  No CI configured. **Not merged, not deployed.**
- WebBrand SSL renewal e-mail **sent** 17 Oct to the WebBrand contact (only address on file, from 2022), Gmail
  signature included. Certificate (www + apex) still expires 1 Nov 2026.
- Docs on `feat/backup-alerts`: `DIWALI_2026_BROADCAST_CHECKLIST.md`, `WEBBRAND_SSL_RENEWAL_REQUEST.md`, register.

**Verified state**
- Production `coolify-deploy` = `96329cb` (PR #5 + #7 live). GA4 `G-74EZWDS33Z` live; Google Ads tag and Meta Pixel not live.
- Nightly backup workflow: last success 16 Oct 22:54 UTC. Restore never tested. PR #4 open, `BACKUP_ENCRYPTION_KEY` missing.
- Cognito → CRM: Apps Script not running (no `CRM-synced` label); 5 enquiries 7–13 Oct not in CRM via script.
- WhatsApp: 14 templates Active (quality pending); 3 new service templates not submitted; 17 Oct festival test failed
  (Meta frequency limit). Number quality High.
- Meta Ads act 343079872519451: campaigns on Payment error, no results 17 Sep–15 Oct.
- Google Ads 988-668-0860: Balance exhausted; 4 paused + 1 eligible campaign, 0 delivery last 7 days. Second account
  995-688-3837 exists (purpose unverified).
- CRM roles (local QA copy): ADMIN full; OPERATIONS no money pages/figures; ACCOUNTS no profit/marketing/users/audit.

**Owner actions**
1. Watch for WebBrand reply / bounce; re-check certificate expiry after renewal.
2. Coolify env: `EMAIL_LEAD_TOKEN`, `META_CAPI_TOKEN`, `NEXT_PUBLIC_META_PIXEL_ID`, Google Ads id + lead label → redeploy.
3. Install `docs/cognito-email-lead.gs` (DRY_RUN first) — picks up the last 14 days of Cognito mail.
4. GitHub secret `BACKUP_ENCRYPTION_KEY`, then merge PR #4; merge PR #8 when ready.
5. Billing decisions for Meta Ads / Google Ads; decide on submitting the 3 WhatsApp templates.
6. Cancel the 187 stale SMS before connecting an SMS gateway.

**Resume first:** Cognito DRY_RUN verification once the owner has installed the script and set the token
(then PR #8 live dedup test after merge). Recommended model: Sonnet (well-defined checks); Opus only for a
production incident or restore drill design.

**Blocked for Claude (safety guard):** Coolify dashboard actions, production merges, reading the local QA password
for browser login.
