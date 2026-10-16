# Google Ads & Meta Ads → Sahara OS CRM — lead flow runbook (2026-10-16)

How an ad click becomes a CRM lead today, how the data is cleaned, and what the owner must switch on. Verified from
the code (`src/server/actions/public-booking.ts`, `src/lib/attribution.ts`, `src/components/public/attribution-capture.tsx`)
and tests. Nothing was changed in Google Ads or Meta.

## 1. Flow
```
Ad click (Google / Meta)
  → booking.saharacleaningservices.com/landing/<service>?utm_source=…&utm_campaign=…&gclid|fbclid=…
  → AttributionCapture stores the first/last touch (UTM, gclid, fbclid, landing page) in the browser
  → customer submits the landing form (name, mobile, area, service — optional WhatsApp opt-in*)
  → publicBookLead (server): validates + cleans → creates/reuses Lead (+ Customer), follow-up, team alert
  → browser fires GA4 generate_lead + ONE Google Ads conversion (marketing-tags.tsx `trackLead`; only if the IDs are configured)
```
`trackLead` also sends the Meta Pixel `Lead` event when the Pixel is loaded (landing pages load it via `MarketingTags
withPixel`). **Bug found 16 Oct:** the main booking form (`public-booking-form.tsx`) sent Meta `Lead` itself **and** via
`trackLead` → every booking counted **twice** in Meta. Fixed on branch `fix/meta-lead-double-count` (one Lead per submit).
\* The opt-in checkbox is on branch `qa/whatsapp-launch-v2` (not deployed yet).

There is **no direct Meta Lead Ads (instant form) or Google lead-form webhook**: all ad leads arrive through Sahara's own
landing pages. This keeps one validated entry point and one conversion per lead. A native Meta Lead Ads integration is
possible later (needs a Meta app + `leads_retrieval` permission + Business Verification) — not built.

## 2. Sanitisation (raw ad data never enters the CRM unchecked)
| Field | Rule |
|---|---|
| Name | 2–100 characters |
| Mobile | must be a valid Indian mobile (`6-9` + 9 digits); `+91`/0 prefixes normalised |
| E-mail | valid format, ≤ 120 chars (optional) |
| Area / address / PIN / package | length-capped strings |
| UTM / gclid / fbclid / landing page | `sanitizeTouch()`: strings only, each cut to 200 chars; campaign name ≤ 120 |
| Spam | honeypot field + server-side duplicate safety (same number → existing lead) |
Tests: `npm run test:public` (5/5) and the attribution checks in `npm run test:pricing`.

## 3. Lead fields used for reporting
`source`, `acquisitionChannel` ("Google Ads", "Meta Ads", …), `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`,
`utmContent`, `gclid`, `landingPage`, `area`. Report: CRM → Profit → Marketing (filter by campaign/channel).
Zone plan and tracking template: `docs/ads-audit-east-pune.md` §4.

## 4. Owner switches (in order; each is a production change)
1. Merge release PR #5 (landing pages, true 404s, faster images).
2. Coolify → Environment: set the public IDs `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID`,
   `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL`, `NEXT_PUBLIC_META_PIXEL_ID` **as build-time variables**, then redeploy
   (the Dockerfile in PR #5 passes them to the build). Today nothing loads on production.
3. One internal test lead marked as a test (owner present) → check GA4 DebugView / Google Tag Assistant / Meta Test
   Events show exactly **one** lead each, and the CRM lead has the UTM fields.
4. Only then change the ads' final URLs from `promo.` to `booking.…/landing/*` and add the tracking template.
5. Budget and campaign activation remain the owner's decision (`docs/META_BUSINESS_GREEN_TICK_SETUP.md` Part A first:
   old Meta campaigns Off).
