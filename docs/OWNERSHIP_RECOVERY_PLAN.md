# Sahara — Marketing ownership recovery & campaign continuity plan

Audit date 2026-10-15. Read-only (owner's signed-in Chrome; public files). Nothing was changed: no DNS, GTM publish, website deploy, campaign edit, spend, access request or revocation. Brand Make / WebBrand were **not** contacted. Sequence used throughout: **Recover → Backup → Build Sahara-owned replacement → Test → Approve → Switch over → Revoke agency access.**

## 0. Verified current state (evidence)
| Asset | Verified finding |
|---|---|
| Google Ads 988-668-0860 | 1 user: contact@saharacleaningservices.com (Admin, passkey on, since 2019-01-30). **Managers: none** (Brand Make link removed), 0 pending approvals. Billing: Sahara's own Visa ending 2994, manual payments; balance ₹0.37. |
| Google Ads campaigns (1 Feb–31 Aug 2026) | **"Home Cleaning Search Camapign \| Pune \| Feb'26"** — Search, Maximize conversions, ₹620/day, *Eligible* (not serving: no funds): ₹90,963 spend, 6,011 clicks, 36,425 impr., CTR 16.5%, 1,908 conversions, ₹47.67/conv. Paused: "Cleaning services" (₹2,000/day, some ads disapproved), "Sahara Cleaning Services" (Smart), "Sahara feb 2025", "Search Campaign : 22 April, 2025". 2 drafts in progress. |
| Landing pages of the ads | All on **promo.saharacleaningservices.com** (`/` ₹76,638; `#services` ₹3,435; `#cta` ₹674; `#home` ₹328; `#why-choose-us` ₹17). |
| Keywords / search terms | Current UI view is filtered; the 2026-10-05 read-only audit (repo `SAHARA_MASTER_SYSTEM_RECORD.md`) recorded: "cleaning services near me" ≈ ₹44k (~48% of spend); competitor and low-value small-job terms; location "presence or interest" (~58% of spend outside the 8 km radius); ~1,590 of 1,908 conversions are "phone call leads" (419 real calls); ad text "Lowest Cost Guaranteed" (unsubstantiated). |
| Google Ads conversion goals | Submit lead form (1 action, active, 4/4 campaigns), Phone call lead (6 actions, *needs attention*), Contact, Get directions, Leads from messages — all inside Sahara's own Ads account. |
| GA4 | Account **383708287 "Sahara Cleaning"**, property 523634206 "Sahara Cleaning Services", web stream "Sahara Cleaning" `https://saharacleaningservices.in`, **G-74EZWDS33Z**, no data in the last 48 h. contact@ has **read access but no Administrator role** ("cannot add/remove users"); property access, product links (Ads link) pages return "Incorrect permissions". Administrator identity: **unknown**. |
| GTM | **GTM-WPM2QXCX** (published version 8) is **not** in contact@'s Tag Manager (no accounts). Owner unknown. Public `gtm.js` shows 24 tags (below). |
| Search Console | contact@ has **no properties**. Owner states WebBrand controls it. |
| Meta Business Portfolio 152082702561104 | Sahara-owned; 2 full-access people; 0 partners; Page + Instagram + WABA owned; **no ad accounts, datasets or domains**; Business verification **Unverified**; Security Center: no trusted domains, 1 user without passkey. |
| Meta ad account 343079872519451 | Roles: "Sahara Cleaning Services" (admin) and Altaf Shaikh (admin); contact e-mail saharaenterprises161@gmail.com; **not in any portfolio visible to Sahara**; funds ₹0, no payment method; 3 old campaigns On/"Payment error"; Events Manager shows only dataset "Sahara OS Messaging", **no web Pixel**. |
| Meta Pixel used by the agency page | **1434208038106754** (inside GTM-WPM2QXCX) — **not accessible** to Altaf's login → not Sahara's. |
| Microsoft Clarity | project **veo10pku4y** (inside GTM) — owner unknown. |
| Old landing page | sahara-lp-rho.vercel.app (Vercel, owner unknown) + copy at promo.saharacleaningservices.com (Hostinger shared 82.180.143.191). Reference audit saved in Drive "Sahara/Marketing Assets/Brand Make Landing Page Audit". |
| Booking site | booking.saharacleaningservices.com — **no GA4/Ads/Pixel tags load** (env IDs not set at build). |

### GTM-WPM2QXCX public tag inventory (reference for the rebuild — not an export)
- GA4 config `G-74EZWDS33Z`; GA4 events: *GA4 Code*, *Call Link Click*, *Form Submit*, *Scroll Depth*, *Call Now*, *Book Your Slot Btn*, *WA Btn Link Click*, *Thank You Page View*, *Book Now Btn*.
- Google tag `AW-765890204`; Ads conversion (`awct`) label `MiIICNWVx_UbEJydmu0C`; Ads **call** conversion from website (`awcc`) label `AmE0CJ_gx_UbEJydmu0C`; conversion linker.
- Meta Pixel template, pixel `1434208038106754`, PageView; Microsoft Clarity template, project `veo10pku4y`.
- Triggers: clicks on `tel:+918956567130`, `https://wa.me/+918956567130`, button text "Call Now"/"Book Your Slot"/"Book Now", form submit, URL contains `thank-you`, scroll depth, page load. Consent mode (analytics_storage) variables present.
- The two Ads conversion labels belong to **Sahara's** Ads account, so Sahara can fire the same conversions from its own tags — conversion history stays in the same actions.

## 1. GA4 — recover / preserve history
Options (in order of preference):
1. **Administrator grant** — an existing administrator adds contact@ as Administrator (owner asks; Claude does not contact them). Then Sahara can manage users, links and, if wanted, move the property into a Sahara account (moving requires Administrator on both accounts).
2. If not granted: **Backup** what contact@ can already read — export key reports (traffic acquisition, events, key events, landing pages; Feb–Oct 2026) to CSV/PDF into Drive. *(Non-destructive; on owner's go-ahead.)*
3. **Build** a new Sahara-owned GA4 property (account created by contact@) and stream for `booking.saharacleaningservices.com` (+ `www`). Historical data cannot be copied between properties; the old property stays readable as long as access remains.
Note: the old stream URL is `saharacleaningservices.in` (different domain) and has had no data in 48 h.

## 2. GTM — owner & replacement
- Owner cannot be identified from public data (container internal ID appears in trigger IDs as 243001772). Only the account owner can export the container JSON (Admin → Export container) — **owner action: ask the current owner for the export**; Claude will not contact them.
- **Replacement plan (recommended regardless):** Sahara does not need GTM for the booking site — Sahara OS already contains `marketing-tags.tsx`, which loads GA4 / Google Ads / Meta Pixel directly from Sahara-owned IDs and sends `generate_lead`, `call_click`, `whatsapp_click` and booking-funnel events. If GTM is preferred, create a new container under contact@ and rebuild from the inventory above. Either way: **no publish without approval.**

## 3. Search Console — Domain property plan (needs DNS approval)
1. contact@ → Search Console → Add property → **Domain** → `saharacleaningservices.com` → copy the `google-site-verification=…` TXT value.
2. Owner (Namecheap → Domain List → Manage → Advanced DNS → Add new record → TXT, Host `@`, value as given, TTL Automatic) — **owner approval required; this only adds a record and does not affect the website, mail or booking.**
3. Click Verify (may take minutes–hours). Result: Sahara becomes a verified owner of all subdomains (`www`, `booking`, `promo`, …). Existing WebBrand access is unaffected until Sahara decides to remove it (later, after switch-over).
4. Submit sitemaps: `https://www.saharacleaningservices.com/sitemap_index.xml`, `https://booking.saharacleaningservices.com/sitemap.xml`.

## 4. Google Ads — preserve, then test
- **Preserve:** do not edit or remove the original campaigns; all history stays in account 988-668-0860.
- **Before any spend:** (a) set Sahara-owned tags on the destination (Section 6); (b) fix "Phone call lead – needs attention"; (c) choose one primary lead conversion (form submit) and keep calls separate.
- **Test plan (approval + budget needed):** duplicate the main campaign as a draft/experiment → point it to the new Sahara landing page → tighten location to "Presence" in the service area → add negatives for competitor and small-job terms → replace "Lowest Cost Guaranteed" with substantiated copy → 50/50 experiment for 2–3 weeks at a small daily budget → compare CRM-qualified leads (not platform conversions) before switching.

## 5. Meta — reuse the existing ad account
- Ad account 343079872519451 has only Sahara admins and no agency; it is eligible for Sahara's portfolio: Business settings → Ad accounts → Add → **Add an ad account** (ID 343079872519451). Requires an admin of the ad account (Altaf is) — **owner approval; ownership by the portfolio is effectively permanent.** No need to create a new ad account.
- Before adding any payment method: switch off/review the 3 old "On" campaigns.

## 6. New Sahara-owned tracking, landing page and lead routing
- **Pixel:** create a dataset in the Sahara portfolio (Events Manager → Connect data → Web), assign it to ad account 343079872519451, verify domain `saharacleaningservices.com` (DNS TXT — owner approval), add trusted domains.
- **Events:** PageView; Lead (form submitted, server-confirmed); Contact (call/WhatsApp tap); Schedule (site visit). Conversions API later via Sahara OS server.
- **Google:** keep conversion IDs/labels `AW-765890204` / `MiIICNWVx_UbEJydmu0C` (lead) and `AmE0CJ_gx_UbEJydmu0C` (website call) — set `NEXT_PUBLIC_GOOGLE_ADS_ID=AW-765890204` and the lead label in Coolify; GA4 = new Sahara property ID (or the old one once Administrator is granted).
- **Landing pages:** Sahara OS `/landing/*` on `booking.saharacleaningservices.com` — Home Cleaning, Commercial/Office, Interior Painting, Pest Control; Call/WhatsApp to **7083347130**; prices from the pricing master; genuine reviews link; privacy/consent text.
- **Lead routing:** form → Sahara OS CRM intake (UTM + gclid/fbclid stored on the lead, de-duplicated) → Admin/Accounts/Operations alerts; call/WhatsApp taps tracked as separate events.

## 7. Dependency map — migrate BEFORE revoking anything
| Dependency | Today | Must exist first | Then revoke/retire |
|---|---|---|---|
| Ads conversions (lead, website call) | Fired by agency GTM on promo page | Same labels fired by Sahara tags on Sahara page (tested in Tag Assistant) | Old page/GTM |
| GA4 data | Old property via agency GTM | Sahara GA4 (new or admin-granted) receiving data + report export saved | Agency GTM |
| Meta Pixel 1434208038106754 | Agency pixel on promo page | Sahara dataset on Sahara page, domain verified | Old page |
| Clarity veo10pku4y | Agency | Optional Sahara Clarity project | Old page |
| Ads final URLs | promo.saharacleaningservices.com | New Sahara landing pages live + tested | Change final URLs (approval) |
| promo DNS record | Points to Hostinger 82.180.143.191 | Ads no longer use it | Remove/repoint A-record (approval) |
| Search Console | WebBrand | Sahara Domain property verified | Remove other owners (approval) |
| Vercel / EmailJS | Unknown owners | Nothing depends on them once ads move | — |

## 8. Owner actions (one at a time)
1. Ask the current GA4 administrator (you, not Claude) to grant contact@ **Administrator** on account 383708287 — or approve creating a new Sahara GA4 property.
2. Approve the Search Console **TXT record** in Namecheap (Section 3).
3. Approve adding ad account 343079872519451 to the Sahara portfolio.
4. Approve setting the public tracking IDs in Coolify + redeploy (production change).
5. Later: approve the test budget for Google Ads / Meta.

## 9. Update 2026-10-15 (later) — existing landing pages, VPS and test results
### What already exists (verified)
- **Sahara-owned landing pages already exist and are LIVE in production** on the Sahara VPS (Coolify app `s-a-h-a-r-a--o-s`, branch `coolify-deploy` = `f81fbdb`; built in commit `a24a7b7`, 2026-10-10):
  - `https://booking.saharacleaningservices.com/landing/home-deep-cleaning-pune`
  - `https://booking.saharacleaningservices.com/landing/office-commercial-cleaning-pune`
  - `https://booking.saharacleaningservices.com/landing/interior-painting-pune`
  - `https://booking.saharacleaningservices.com/landing/pest-control-services-pune`
  These are ad pages: `noindex,nofollow`, canonical set, one service each, sticky lead form, Call + WhatsApp CTAs, trust numbers read from CRM settings (not typed in code), prices from the pricing master. The indexable service hub pages also exist: `/home-deep-cleaning-pune`, `/commercial-cleaning-pune`, `/interior-painting-pune`, `/pest-control-pune` (title, description, canonical, FAQ + LocalBusiness schema). **No duplicate landing page is needed.**
- Lead form → `publicBookLead` server action (Sahara OS CRM): validation, honeypot, server-side duplicate safety, UTM/gclid/fbclid/landing page captured by `AttributionCapture`; `trackLead` fires GA4 `generate_lead` and one Google Ads conversion. **No EmailJS or other third-party form service.**
- **Gap:** `marketing-tags.tsx` only loads GA4 / Google Ads / Meta Pixel when `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL`, `NEXT_PUBLIC_META_PIXEL_ID` are set at build time — on production nothing loads today.
- **Coolify:** 1 project ("My first project"), 1 environment ("production"), 1 application (Running). **No staging environment.** TLS by Traefik/Let's Encrypt; domains crm./booking./app. on the same app.

### Isolated end-to-end test (local dev server, scratch database, fake tracking IDs `G-TESTQA0000` / `AW-111111111` / `QA_TEST_LABEL` / pixel `1111111111111111`; WhatsApp/SMS/e-mail/sheet credentials blanked, WhatsApp TEST mode)
| Check | Result |
|---|---|
| Page renders (`/landing/home-deep-cleaning-pune?utm_source=google&utm_medium=cpc&utm_campaign=qa_test_campaign&utm_term=…&gclid=QA-TEST-GCLID-123`) | 200 |
| Tags load when IDs are set | gtag `config` for GA4 + Ads, Meta `fbevents.js` + `fbq` present |
| Attribution stored client-side | `sahara_attr_first` / `sahara_attr_latest` in localStorage |
| Empty submit | "Please enter your name." |
| Invalid mobile (12345) | "Enter a valid 10-digit mobile number." |
| Valid submit (QA Test Lead, 9000000099, Kharadi) | Thank-you state "Request LD-2026-0001 received" |
| CRM lead (scratch DB) | stage NEW, service HOME_DEEP_CLEANING, **source GOOGLE, acquisitionChannel "Google Ads", utmSource google, utmMedium cpc, utmCampaign qa_test_campaign, utmTerm "home deep cleaning", gclid QA-TEST-GCLID-123, landingPage /landing/home-deep-cleaning-pune**, 1 follow-up, customer record created |
| Conversions fired | GA4 `generate_lead` ×1 and Ads `conversion` ×1 (send_to AW-111111111/QA_TEST_LABEL) — **no double counting** |
| Outbound messages | WhatsApp row CANCELLED by TEST mode — nothing left the machine |
| Marketing consent | `UNKNOWN` — the landing form had no opt-in → fixed on branch `feat/landing-consent` `e2a79cf` (optional, unticked checkbox, booking-wizard wording; `tsc` clean; not E2E-tested; not deployed) |
| Mobile layout (built-in browser, true 375 px viewport) | All 4 landing pages: `scrollWidth = 375` (no horizontal overflow) |
Scratch DB deleted and test server stopped after the run. Production CRM was not touched.

### Correction
The Brand Make audit (Drive `Brand-Make-Landing-Page-Audit.md`, §7 item 2) said the Vercel page's mobile headline overflows. Re-measured in a real 375 px mobile viewport: **no overflow** (`scrollWidth 375`, H1 fits) — the earlier screenshot cut-off was an artefact of headless Edge on Windows. That Drive file was not edited (Drive is frozen); this section is the correction.

### Open items found on the live pages (owner decisions, not changed)
- Landing-page **Call** buttons use **+91 89565 67130** (`CONTACT.call[0]`); WhatsApp uses 7083347130. Older notes describe 8956567130 as "operations/internal" while the GBP lists 8956567130 — owner to confirm which number ads should call.
- Hub pages show "1,800+ reviews", "4.9 Rated" and "guaranteed" wording; the numbers come from CRM settings — owner to keep them in line with the live Google profile.

### Safest way to finish on the VPS
1. Owner approves the public IDs → set in Coolify (`NEXT_PUBLIC_GOOGLE_ADS_ID=AW-765890204`, `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL=MiIICNWVx_UbEJydmu0C`, GA4 ID (old or new property), Meta Pixel ID of a new Sahara dataset) → redeploy (production change).
2. Merge `feat/landing-consent` with the same deploy.
3. Optional staging: a second Coolify application on the same server with its **own empty database volume** and an sslip.io hostname (no DNS change) — creates a new live resource, so it needs approval.
4. Verify with Tag Assistant / Meta Test Events on the live page using one internal test lead marked as test (owner approval), then switch Google Ads final URLs from promo. to `/landing/*`.
