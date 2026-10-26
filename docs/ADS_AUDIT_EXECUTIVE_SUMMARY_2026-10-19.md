# Ads Audit — Executive Summary (2026-10-19)

Sahara Cleaning Services, Pune. Prepared from the read-only audits of 5/15/16 Oct (`OWNERSHIP_RECOVERY_PLAN.md`,
`CAMPAIGN_AUDIT_AND_ADS_OPTIMIZATION.md`, `ads-audit-east-pune.md`), the live CRM checks of 19 Oct and the Sahara OS code.
**Nothing was changed in any ad account.** Every spend, access or billing change needs the owner (SOS-14).

## Corrections to the brief (please read first)
| Brief said | What the records show |
|---|---|
| Google Ads account **892-332-3597** | Every audit on file used **988-668-0860** (signed in as contact@, Admin since 2019). Confirm which ID is correct before any change. |
| Brand Make (898-956-9172) is still linked; unlink them | **Already removed on 15 Oct** (SOS-07 verified): Managers list empty, 0 pending requests, Sahara the only user. Nothing left to unlink. If you see a *new* manager request, do not accept it. |
| Missing GA4 / Meta Pixel on the main site | **Now live on booking/crm**: Meta Pixel + Conversions API connected, GA4 connected, Meta domain verified. Still **not set**: Google Ads tag and Google Ads lead conversion (shown "not set" on the Marketing dashboard). |
| Deploy the 3 templates "via Click-to-WhatsApp ads" | Templates are **outbound broadcast** messages, not ad creatives. A CTWA ad uses a pre-filled opening message; templates are for follow-up to opted-in contacts. See §B. |
| Meta ad account owned by the agency | Old account `343079872519451` sits **outside** the Sahara business portfolio; ownership unconfirmed. See §B. |

## A. Google Ads
**Status.** Funds exhausted, no spend since August, campaigns idle; balance ₹0.37 on Sahara's own card (manual payments).
Old main campaign: ₹90,963 spend, 6,011 clicks, CTR 16.5%, 1,908 "conversions".

**Why removing the agency was right.** Ownership of the account, billing, history and conversion data sit with the account
owner (contact@); a manager link only grants delegated access. Removing the link keeps all campaign history and reports,
stops a third party editing ads or reading data, and leaves Sahara able to re-link any agency later on its own terms.

**Issues found.**
1. Conversion data inflated: ~1,590 of 1,908 conversions were "phone call leads" (only 419 real calls); goal flagged "needs attention".
2. Location setting "presence **or interest**": ~58% of spend landed outside the 8 km radius.
3. "cleaning services near me" ≈ 48% of spend — the keyword is valid, the location setting was the leak.
4. Competitor, job-seeker and small-job search terms; no shared negative list.
5. Ad text "Lowest Cost Guaranteed" is an unprovable claim (policy and trust risk).
6. Final URLs pointed to `promo.` / a Vercel page run by the agency — no Sahara-owned tracking.
7. Missing Google Ads tag and lead conversion (still "not set"); landing speed was an issue (hero image cut 145→30 KB, logo 86→29 KB in PR #5; **re-measure LCP** after deploy).

**Recommended.**
- Fresh Sahara-owned structure; keep the old campaigns untouched. One Search campaign per service (home deep cleaning, pest, painting, facility/AMC).
- Final URLs `booking.saharacleaningservices.com/landing/*` with the tracking template `{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={_campaign}&utm_term={keyword}&utm_content={_zone}` (full detail: `ads-audit-east-pune.md` §4a).
- **Presence-only** targeting for East Pune zones; high-intent localized phrase/exact keywords ("home deep cleaning Magarpatta", "… Kharadi", "… Pune", "pest control Pune", "interior painting Pune") instead of broad match; apply the shared negatives list.
- One primary conversion = landing-form submit (Sahara OS fires exactly one per lead); calls and WhatsApp clicks secondary.
- Judge on **CRM cost per booked job**, not platform conversions. Suggested test budget ₹500–700/day, owner sets the amount.

## B. Meta Ads (Click-to-WhatsApp + lead ads)
**Status.** Old ad account sits outside the Sahara portfolio; 3 old campaigns show On with "payment error". A Sahara-owned ad account with the owner's own payment method is needed. Pixel + CAPI + domain verification are done; Business verification done, green tick pending.

**Why sends were blocked ("not delivered to maintain healthy ecosystem engagement").**
This is Meta's per-recipient marketing-message limiting (API error 131049). On 19 Oct the CRM log shows pest = SENT,
painting and facility = FAILED within one minute to the same QA number, and the 17 Oct Diwali test failed the same way.
Meta does not publish the exact thresholds, but the pattern is: several marketing-category templates to one number in a short
time, low engagement, or no recent reply from that user. How to stay clear:
- **Opt-in:** send marketing only to numbers with recorded opt-in (Sahara OS already refuses others and honours "Stop promotions").
- **Service window:** when a customer messages first (for example via a CTWA ad) a 24-hour window opens for free-form replies; template messages are needed outside it. A CTWA ad conversation also opens Meta's free-entry-point window, so follow up there rather than with cold marketing templates.
- **Pacing:** one marketing template per recipient per day at most; QA tests one at a time on different days; do not repeat to a number that has not replied.
- Prefer a utility template or a free-form reply inside the window for anything transactional.

**Gaps.** No localized video creatives; generic audience; ads not yet created.

**Recommended.**
- Create the Click-to-WhatsApp ad in the Sahara-owned account pointing at **+91 91752 20270** (the Cloud API number whose webhook feeds the CRM). Never 7083347130.
- Pre-filled messages per service ("Hi, I want a quote for pest control"), one ad set per service; the lead capture records the ad id and headline automatically (Marketing dashboard → Click-to-WhatsApp ads). UTM parameters cannot ride on a WhatsApp destination; attribution comes from the ad referral data. Use `utm_source=meta_ads&utm_medium=cwc` only on **website** links (ad website URL, template buttons).
- Use the 3 approved templates (`sahara_pest_control_offer`, `sahara_painting_offer`, `sahara_facility_management_offer`) for follow-up broadcasts to opted-in contacts once `WHATSAPP_CAMPAIGNS=on`.
- Instant alerts: ad leads already alert Altaf and Shoyab (Francis gets the masked version, never the customer number); the 30-minute escalation pings Altaf if nobody picks it up.
- Geo: Pune + PCMC, radius around Undri / Hadapsar / Kharadi first; short real before-and-after video per service.

## C. Technical work done this session
- Email signature: logo is **no longer a link**; Settings → Company now has **Email signature logo width / height (px)** (width 80–400, height optional 20–300; applies to the next email sent).
- `/api/webhook/email-lead` (Cognito): reviewed and tested (25 tests pass). Duplicates are matched by mobile **and** by e-mail (open lead, or any lead in the last 24 h), repeat enquiries are logged on the lead and alert the team; a new lead creates a follow-up due in 30 min and alerts Admin, Accounts and Operations in-app (Operations masked), with a WhatsApp copy to Admin and Accounts (TEST mode still limits who actually receives it). Needs `EMAIL_LEAD_TOKEN` set in Coolify and the Apps Script deployed on contact@ (**owner**).
- Backup drill: built an archive in the same format as `GET /api/backup` (`sahara-os-*.tar.gz`) from a snapshot of the tracked seed DB, ran `npm run restore:drill` in a temp folder (not production): **RESTORABLE**, integrity `ok` before and after migration (31 → 64 tables), nothing lost. **Encryption is not in main yet** — `BACKUP_ENCRYPTION_KEY` belongs to PR #4 (not merged); the drill checked the plain archive.

## D. Owner action items
1. **Google Ads:** confirm the real account ID (892-332-3597 vs 988-668-0860); keep Managers empty; keep a passkey sign-in on your devices; add funds only after the new campaigns are approved.
2. **Meta:** add a payment method in a Sahara-owned ad account; switch the 3 old "payment error" campaigns **Off first**; point CTWA ads at +91 91752 20270; green tick (business verification is done).
3. **Workspace / domain:** pay Google Workspace before **2 Nov 2026**; fix the `www` certificate before **1 Nov 2026**.
4. **Search Console:** add the DNS TXT for the Domain property; set `NEXT_PUBLIC_GOOGLE_ADS_ID` / lead label when Google Ads goes live.
5. **Cognito:** set `EMAIL_LEAD_TOKEN` (and optionally `EMAIL_LEAD_HMAC_SECRET`) in Coolify and in the Apps Script properties.
6. **Backups:** set `BACKUP_ENCRYPTION_KEY` and merge PR #4 when you want encrypted archives.
7. **Email signature:** add the LinkedIn URL and, if wanted, a logo width in Settings; add `EMAIL_API_KEY` / `EMAIL_ENDPOINT` / `EMAIL_FROM` so signature emails can actually be sent.
8. **WhatsApp:** `WHATSAPP_CAMPAIGNS=on` only when you approve live sends; retry the QA test one template per day.
