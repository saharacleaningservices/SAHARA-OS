# Meta Ads — setup plan (2026-10-19)

Planning document. **Nothing was created or changed in Meta.** Creating the ad account, adding a payment method and
switching campaigns on or off are owner actions. Builds on `docs/ADS_AUDIT_EXECUTIVE_SUMMARY_2026-10-19.md` (§B and §D)
and `docs/ADS_RECOMMENDATIONS_2026-10-18.md` §2.

## 0. What the audit says is open for Meta
1. Old ad account `343079872519451` is outside the Sahara business portfolio; 3 old campaigns show On with "payment error" (audited — see §0a: no spend history, no audiences).
2. No Sahara-owned ad account with the owner's payment method yet.
3. Already done and live: Pixel + Conversions API connected, domain verified, Business verification done (green tick pending), Click-to-WhatsApp (CTWA) lead capture in the CRM.
4. Gaps: no localized video creative, generic audiences, ads not yet built.

## 0a. Audit of existing Meta assets (live, read-only, 2026-10-19, signed in as the owner)
Nothing was changed. Checked in Business Settings, Ads Manager, Billing and Events Manager.

| Item | Finding |
|---|---|
| Business portfolio | **"Sahara Cleaning Services."** (business id 152082702561104) exists with the Facebook Page (~952 followers) and Instagram (~92 followers). **Ad accounts: none** ("No ad accounts added"). |
| Old ad account `343079872519451` | Accessible with the owner login, but **not part of the business portfolio**: Events Manager returns "Your ad account is not a part of this business". Roles: Altaf Shaikh and "Sahara Cleaning Services" as ad account admins, **no external manager or agency listed**. Contact emails on it: saharaenterprises161@gmail.com and contact@ (pending confirmation), phone 7083347130. |
| Campaigns | 3, all **On** with delivery "Payment error": a boosted post ("Keep your glass maintain and clean…"), "INDEPENDENCE DAY SALE", and a boosted post ("Sahara Cleaning Services was live."). |
| Performance / learning data | **None.** Results and cost per result are blank for the whole account lifetime (Sep 2023 – Oct 2026); no recent spending. Nothing to carry over. |
| Billing | Available funds ₹0.00, **no payment method**, no ad credits; Meta daily limit ₹14,087; business info and GSTIN 27DMTPS3584R2ZJ shown as verified. |
| Custom audiences / lookalikes / saved audiences | **None** in the old account. |
| Pixel / dataset | Not reachable from the old account (outside the portfolio). The live Pixel + Conversions API connected to booking.saharacleaningservices.com is in the portfolio and is what the new account should use. |

**Recommendation: set up a new ad account inside the portfolio.** The old account has no spend history, no audiences and no learning to
leverage, it sits outside the business (so the portfolio Pixel, dataset and WhatsApp number cannot be used with it), and all three campaigns
are On with payment errors that would start delivering the moment a payment method is added. Resolving it would mean claiming it into the
portfolio and adding payment for no benefit. Leave it untouched (do not add payment there); switch its 3 campaigns **Off** as a one-time
owner tidy-up. Create "Sahara Cleaning — Pune" as in §1.

## 1. Link the Business portfolio to the CRM's tracking (one-time)
Owner signs in; each step is in Meta Business Settings (business.facebook.com/settings).
1. **Ad account:** Accounts → Ad accounts → Add → *Create a new ad account* (name "Sahara Cleaning — Pune", currency INR, time zone Asia/Kolkata), owned by the Sahara business portfolio. Do **not** claim `343079872519451` unless Altaf confirms it is his own.
2. **Old campaigns:** switch the 3 "payment error" campaigns **Off** in the old account before adding any payment method there.
3. **Payment:** Billing → add the owner's own method (owner only).
4. **Assets to attach to the new ad account:** the Facebook Page, Instagram account, the Pixel/dataset already connected to booking.saharacleaningservices.com, and the WhatsApp number **+91 91752 20270** (the Cloud API number whose webhook feeds the CRM). Never the 7083347130 app account.
5. **People:** Altaf = admin; Shoyab = advertiser only if needed. No agency access.
6. **Tracking parameters on every ad** (Ad → Tracking → URL parameters), exactly:
   `utm_source=meta_ads&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}`
   The CRM maps `utm_source=meta_ads` to the **Meta Ads** channel (`src/lib/attribution.ts`), so leads from the booking form land in Marketing → Meta Ads with campaign, ad and ad set. Name campaigns lowercase with underscores (e.g. `meta_pest_pune_2026_10`).
7. **CTWA ads cannot carry UTMs** on a WhatsApp destination. Attribution there comes from Meta's referral data: the CRM stores the ad id and headline on the lead (Marketing → *Click-to-WhatsApp ads* card). Name each ad after its service so that card reads cleanly.
8. **Test before spend:** one tagged test lead (booking form) and one CTWA test message; confirm both appear in Marketing and in Events Manager → Test events.

## 2. Hyper-local audience (satellite areas and pincodes)
Targeting: **Pune + PCMC, age 25–55, English / Hindi / Marathi**, location type **People living in this location** (not "recently in"), broad interests (let delivery learn). PINs below are the usual ones for each locality; **verify each one in Meta's location search** (Meta may not accept a PIN and may need the locality name or a radius pin instead).

| Phase | Zone | Localities | Main PINs |
|---|---|---|---|
| 1 (start) | Z1 Core | Undri, NIBM, Kondhwa, Wanowrie, Mohammed Wadi | 411060, 411048, 411040 |
| 1 | Z2 Hadapsar belt | Hadapsar, Magarpatta, Amanora, Manjri, Mundhwa | 411028, 412307, 411036 |
| 1 | Z3 Kharadi–Viman Nagar | Kharadi, Viman Nagar, Wadgaon Sheri, Kalyani Nagar | 411014, 411006 |
| 2 (after 2–3 weeks of CRM data) | Z4 North-east | Wagholi, Lohegaon, Dhanori | 412207, 411047, 411015 |
| 2 | Z5 Inner east + PCMC | Koregaon Park, Camp, Baner, Balewadi | 411001, 411045 |

Radius alternative if PINs are rejected: 3–5 km pins at Undri, Magarpatta, and Kharadi. Exclude locations outside Pune/PCMC. Commercial/AMC ad set: add job titles/behaviours (facility, admin, society committee, business owners) on the same geography.

## 3. Creative and copy (Sahara's own portfolio)
Assets already in the repo: `public/marketing/` (hero-home, hero-pest, hero-painting, hero-commercial, carousel-team / equipment / result, the three offer banners) and `public/marketing/catalog/*`. Preferred: short real before/after clips (15–25 s, vertical) shot by the team, one per service; use stills until they exist.
Rules: no price in the ad (pricing master needs owner approval), no "lowest cost" claims, no medical or guarantee wording. Safe claims: *pay after service, trained in-house staff, serving Pune since 2012, free site inspection (painting), written quote before work*. Google rating only if it matches the live profile.

| Service | Primary text (≤125 chars) | Headline (≤40) | CTA |
|---|---|---|---|
| Home deep cleaning | Spotless homes across Hadapsar, Kharadi & Undri. Trained in-house team. Pay after service. | Home Deep Cleaning in Pune | Send WhatsApp message |
| Pest control | Cockroach, termite & bed bug treatment in Pune. Trained staff, pay after service. | Pest Control in Pune | Send WhatsApp message |
| Interior painting | Repaint with a free site inspection and a written quote before work starts. | Interior Painting — Free Inspection | Send WhatsApp message |
| Facility / AMC (B2B) | Housekeeping staff on monthly AMC for offices and societies. Site visit first. | Housekeeping & Facility Management | Send WhatsApp message |

**Pre-filled WhatsApp messages** (customer taps and sends): "Hi, I want a quote for home deep cleaning" / "…pest control" / "…interior painting" / "I need housekeeping staff for my office / society".
Hindi / Marathi variants of the primary text for the same ad sets after the English version shows results.

## 4. Campaign structure
Two campaigns, one ad account, all with the §1 step 6 URL parameters.

**Campaign A — Messages (Click-to-WhatsApp)** · objective *Engagement → Messaging apps → WhatsApp* · number +91 91752 20270
| Ad set | Audience | Placements | Ads |
|---|---|---|---|
| A1 Home deep cleaning | Z1–Z3 | Advantage+ (Reels, Stories, Feed) | 2 videos/images (`home_<angle>`) |
| A2 Pest control | Z1–Z3 | same | 2 (`pest_<angle>`) |
| A3 Interior painting | Z1–Z3 | same | 2 (`painting_<angle>`) |
| A4 Facility / AMC | Z1–Z3 + B2B interests | Feed, Reels | 2 (`facility_<angle>`) |

**Campaign B — Leads to the website (booking form)** · objective *Leads/Sales → Website* with the Pixel `Lead` event (the booking form already sends one deduplicated Lead per submit) · destination `booking.saharacleaningservices.com/landing/<service>` per ad set (home-deep-cleaning-pune, pest-control-services-pune, interior-painting-pune, office-commercial-cleaning-pune). Same four ad sets and zones.

**Budget** (owner sets): test ₹500–700/day in total across Google and Meta; suggested Meta share 40%. Within Meta: A 60% / B 40%; by service Home 40 · Painting 25 · Pest 20 · Facility 15. Let each ad set run 5–7 days before editing; after 3 weeks of CRM data cut by **cost per booked job**, add Z4–Z5.

**Follow-up:** the CRM alerts Altaf and Shoyab on every ad lead (Francis sees the masked version); an unacknowledged inquiry escalates to Altaf after 30 minutes. Only contacts with recorded opt-in receive the three approved templates later, and only once `WHATSAPP_CAMPAIGNS=on`. Pace marketing templates (one per recipient per day) to avoid Meta's "healthy ecosystem engagement" filter.

## 5. Step-by-step launch checklist
1. (Owner) Create ad account + payment method; old campaigns Off. — §1.1–1.3
2. (Owner) Attach Page, Instagram, Pixel, WhatsApp +91 91752 20270. — §1.4
3. (Claude, in Chrome once step 1–2 are done and the owner is signed in) Build Campaigns A and B as drafts, **not published**, with the §1.6 parameters, audiences, copy and pre-filled messages above.
4. (Owner) Review drafts, set daily budget, approve.
5. (Both) Test lead + test CTWA message; verify Marketing dashboard and Events Manager.
6. (Owner) Publish; check after 24 h for delivery and rejections; weekly review by CRM cost per booked job.
