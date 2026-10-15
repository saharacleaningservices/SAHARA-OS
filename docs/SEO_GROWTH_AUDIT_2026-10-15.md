# Sahara — SEO / AEO / GEO first audit (2026-10-15)

Read-only audit. Nothing was deployed, published, purchased, or changed (DNS, tracking, campaigns, GBP and social accounts untouched). Cost: ₹0. VPS impact: none (crawl was ~1 request per 0.25 s against public pages; Lighthouse ran locally).

Status labels: **[Verified]** observed in this audit · **[Blocked]** needs access · **[Proposed]** · **[Approval]** needs owner approval.

## 1. Existing features and integrations discovered
- **www.saharacleaningservices.com** — WordPress (Yoast), cPanel host 192.185.129.241, agency-built. 107 sitemap URLs.
- **booking.saharacleaningservices.com** — Sahara OS (Next.js) on the Coolify VPS: 14 public pages, sitemap.ts, robots.ts, FAQ + LocalBusiness schema on hub pages, PPC landing pages (noindex by design), lead form → CRM lead with first/latest-touch attribution (UTM, gclid, fbclid), Google Sheets copy, WhatsApp consent checkbox (on branch only).
- **Tracking:** GA4 / Google Ads / Meta Pixel loader exists in code but env IDs are not set in production — **no tags fire on booking or www** [Verified]. GTM-WPM2QXCX, Search Console, Pixel are agency-controlled.
- Social: Facebook (~954 followers), Instagram (~85 followers / 32 posts), YouTube channel exists.

## 2. Baseline and data sources
| Source | Used for | Limit |
|---|---|---|
| Own crawl (107 www + 14 booking URLs) | titles, meta, H1, words, alt, schema, canonicals | static HTML only |
| Local Lighthouse (mobile, throttled) | speed | only www home completed; other URLs pending |
| WebSearch + Perplexity (anonymous) | search / AI visibility | **US-based tool, not a true Pune SERP**; single run |
| GA4 / Search Console / GBP | rankings, clicks, impressions | **[Blocked]** — no access (WebBrand owns Search Console) |

Real rankings, impressions, clicks and GBP insights: **no baseline exists yet** and none are claimed.

## 3. SEO and AI-search visibility findings
**AI-search test, 2026-10-15, Perplexity (anonymous, ~10:20 IST), one run per query:**
| Query | Sahara appeared? | Cited / named | Notes |
|---|---|---|---|
| Best home deep cleaning service in Hadapsar Pune | **No** | Urban Company, The Magic Clean, WashTog, DirtBlaster (urbancompany, justdial, washtog, linkedin) | |
| Deep cleaning service near Magarpatta City Pune | **No** | Urban Company, DeepCleanPune, Clean Rider, Mukesh Deep Cleaning, Justdial listings | |
| Office cleaning company in Pune | **No** | MY Cleaning Services, Mukesh Deep Cleaning, Prime Deep Cleaning, All Cleaning Wala, Shri Krupa, Justdial | |
| Reliable pest control in East Pune | **No** | Integrity Pest Control, Omkar, Strong, Max, Reliable (Justdial-heavy) | Sahara has pest control only on booking host |
| Interior painting in Pune | **No** | Asian Paints, AapkaPainter, PaintMyNest | |
Limitations: Gemini/ChatGPT not tested (login required — not attempted); answers vary run to run; results are not location-personalised. Earlier WebSearch showed Sahara only via a third-party directory (threebestrated.in) with an inconsistent "since 2012 / 16+ years" claim.
Pattern: AI answers lean on Justdial, Urban Company and competitors' own service pages. Being cited needs consistent business listings + service pages with price ranges, scope and FAQs.

## 4. Keyword-to-page map (existing pages first; no new mass pages)
| Intent | Target page | Action |
|---|---|---|
| Home deep cleaning Pune / Hadapsar / Magarpatta | booking `/home-deep-cleaning-pune` (hub) + one consolidated www page | [Proposed] strengthen hub with Hadapsar/Magarpatta section, price range, FAQ; consolidate near-duplicate www locality pages |
| Sofa / carpet / mattress cleaning | existing www service pages (Pune, Undri, Kharadi, Hadapsar…) | [Proposed] keep 1 strong page per service; merge/redirect thin duplicates (redirect = WordPress change → [Approval]) |
| Office / commercial cleaning Pune | booking commercial page | [Proposed] add scope, supplies, GST invoicing, trial option |
| Pest control East Pune | booking pest page (no www equivalent) | [Proposed] add warranty, treatment types, area list |
| Interior painting Pune | booking painting page (no www equivalent) | [Proposed] add scope (putty/primer/coats), price-per-sq-ft guidance, damp check FAQ |
| Homepage | www home | currently Kharadi-only keyword-stuffed title, no H1 |

## 5. Local SEO and competitor opportunities
- Competitors seen: Urban Company, The Magic Clean, WashTog, DirtBlaster, DeepCleanPune, Mukesh Deep Cleaning, Integrity Pest Control, Omkar, AapkaPainter, PaintMyNest, Asian Paints.
- GBP: **[Blocked]** — profile edits and insights not touched; read-only public check still pending. Known facts: PIN 411060, phone 8956567130, est. 2012; never touch the Magarpatta profile. Mohammad Wadi Road is an operational office, not a customer visit location.
- Opportunity: consistent NAP + service list + photos + review-request process (genuine reviews only) across GBP, Justdial, IndiaMART; Q&A-style content with real price ranges (competitors publish ₹ ranges and AI answers quote them).
- **Call-number inconsistency** (8956567130 vs 7083347130) must be settled before any citation work. [Approval]

## 6. Technical issues ranked by business impact
1. **No tracking in production** — organic/paid performance cannot be measured. [Approval: env IDs need a build/deploy]
2. **www is slow** — see section 11 (4 URLs measured, causes identified). Home: performance **45**, LCP **9.5 s**.
3. **Duplicate locality pages on www** — corrected in section 12: after the locality name is swapped, 65 of 78 pages are **100 % identical** to their Pune page (the earlier ~0.69 figure did not normalise the place name) → cannibalisation/doorway risk.
4. **65 of 107 www pages are thin (<300 words)**; 29 have no H1; 28 no meta description; 31 titles >60 chars; homepage title keyword-stuffed.
5. **397 of 509 www images lack alt text.**
6. **Topic overlap and gap:** www and booking compete on the same topics; interior painting and pest control exist only on booking.
7. Search Console not owned → no indexing/CWV/query data. [Blocked]
8. No `llms.txt` (low priority, optional).
Booking host: titles/descriptions/canonicals fine, 0 images without alt, sitemap/robots correct.

## 7. Organic lead attribution gaps
- CRM stores source, UTM, gclid/fbclid, first/latest touch — good. But with no GA4/Ads/Pixel loading and no Search Console, organic search cannot be separated from direct/WhatsApp/phone leads beyond landing-page referrer.
- Phone-call and WhatsApp-click leads are not tracked to a page. [Proposed] add click events once GA4 exists.
- No PII goes to analytics (keep it that way: send only event names/source, never phone/name).

## 8. 30 / 60 / 90-day plan
**30 days (no cost):** get Search Console + GA4 access under Sahara ownership; settle call number; complete public-listing/NAP audit; publish nothing yet; prepare title/meta/H1 rewrite list for the homepage and top 10 www pages; prepare consolidation list for duplicate locality pages; finish remaining Lighthouse runs.
**60 days (approval needed to publish):** apply meta/H1/alt fixes; consolidate thin pages with 301s; image compression/caching on www; strengthen booking hub pages (Hadapsar/Magarpatta, pest, painting, commercial); set tracking IDs and deploy; GBP updates by owner.
**90 days:** review Search Console data; 4–6 genuine content pieces (price guides, before/after case studies with consent); citation clean-up; genuine review programme; monthly growth report.

## 9. Expected cost and VPS impact
₹0 for the audit and for the 30-day plan. Hosting is prepaid. No paid SEO tool used (Ahrefs/Similarweb etc. connectors are unauthorised and not needed). VPS: none so far; the later tracking deploy is a small build (see decision report in `CRM_LEAD_CAPTURE_PLAN.md` §11).

## 10. Completed / blocked / approvals
- **Completed and verified:** technical crawl; sitemap/robots check; schema check; Lighthouse (www home); 5-query AI-search test (Perplexity); competitor list.
- **In progress:** Lighthouse for the remaining URLs; GBP/social read-only checks.
- **Blocked by permissions:** GA4, Search Console, GBP insights, Gemini/ChatGPT (login), cPanel/Namecheap tabs not yet in the Claude tab group.
- **Requires owner approval:** tracking IDs + deploy; any www edits/redirects/page consolidation; GBP/social changes; call-number decision; any purchase.

---
# Phase 2 update (2026-10-15, later) — causes, page-by-page plan, tracking, Search Console, staging
Still read-only / local. Nothing deployed, published, redirected, noindexed or changed on any live system. Local dev server started for a tag test was stopped; working tree unchanged apart from this file.

## 11. Mobile performance re-test (item 1)
**Method:** Lighthouse CLI (local Chrome, headless) on this PC in Pune, mobile emulation, simulated throttling (RTT 150 ms, ~1.6 Mbps down, 4× CPU slowdown), one run per URL at about 10:20 IST, 2026-10-15. **Limitations:** lab data only, single run (scores can vary ±5–10), no Chrome UX Report field data, not a real-phone test, one location.
| URL | Perf | LCP | FCP | TBT | CLS | Requests / size | Root doc |
|---|---|---|---|---|---|---|---|
| www home | **45** | 9.5 s | 4.9 s | 570 ms | 0.001 | 96 / 2.7 MB | 940 ms |
| www /sofa-cleaning-services-in-undri/ | 63 | 5.0 s | 4.4 s | 250 ms | 0.013 | 87 / 1.2 MB | 880 ms |
| booking /home-deep-cleaning-pune | 69 | 4.5 s | 2.1 s | 460 ms | 0 | 42 / 0.9 MB | 110 ms |
| booking /landing/home-deep-cleaning-pune | 85 | 3.3 s | 1.9 s | 260 ms | 0 | 22 / 0.4 MB | 90 ms |
(The landing page's SEO score 69 is expected: it is `noindex` on purpose.)

**Measured causes, www home** (not guesses):
1. **Slow server response:** time to first byte 0.9–1.5 s on the shared cPanel host; no caching plugin among the 7 front-end plugins detected, no cache headers on the HTML. Lighthouse puts the saving at ~0.84 s.
2. **Heavy images (1.86 MB of 2.76 MB):** `hands-holding-cleaning-tools-solutions.jpg` 793 KiB, `Deep-Cleaning-768x441.png` 412 KiB (a PNG), `testimonials.jpg` 184 KiB. Lighthouse estimates 582 KiB saveable by resizing/WebP.
3. **Render-blocking CSS/JS:** 45 stylesheets + 27 scripts from Astra + Elementor + 6 add-on plugins (Essential Addons, Qi Addons, Header-Footer, Sticky Header Effects, MyStickyElements, Brave Popup); estimated ~2.0 s blocked. The hero (LCP) is a 1024×1024 JPEG that waits for it.
4. **Icon fonts:** 9 font files (360 KiB: Font Awesome, eicons) with no `font-display` (est. 0.4 s).
Not a cause: unused CSS (only ~36 KiB), layout shift (≈0), third-party scripts (none — no analytics on www).
**Booking host:** server is fast (90–110 ms). The delay is on the client: LCP element render delay 0.9–1.2 s with 600 KiB JS on the hub page (167 KiB on the landing). Exact JS contributors not yet analysed — local bundle analysis is step 1 of the plan (section 15).

**Proposed www fixes (all are live-site changes → owner approval):** (a) resize/convert the three large images to WebP (~0.5 MB); (b) enable page caching + minify/combine CSS (free plugin or host feature; test on a copy first); (c) remove/disable unused add-on plugins after checking which widgets use them; (d) preload the hero image, `font-display: swap`, keep icon fonts subset. **Expected benefit (estimate, not a promise):** LCP in the 3–5 s range on the same test; real gain only provable by re-running this test after the change. **Risk:** Elementor layouts can break when plugins are removed or CSS is combined → do it on a staging copy of WordPress or one page at a time with a backup (cPanel backup first). **Cost:** ₹0 (free plugins).

## 12. Locality pages (item 2) — 78 pages, page-by-page recommendation
Correction to section 6: comparing page text with the place name swapped for a token, **Pune, Undri, Amanora Park, Mohammadwadi and Hadapsar pages are word-for-word identical for every one of the 13 services (similarity 1.00; 65 pages, 13 distinct texts).** Only 7 Kharadi pages have their own text (400–650 words; similarity to the Pune version 0.13–0.69). The other 6 Kharadi pages are identical clones too. So 78 pages contain only 20 distinct bodies. Most are 145–380 words.
**Why it matters:** duplicate pages compete with each other and with the booking host and look like doorway pages; Google may pick one and ignore the rest. **Limit:** no Search Console data, so no page can be proven to rank or get zero impressions — all recommendations are **provisional until impressions/clicks per URL are available** (section 14). Pre-condition for any removal: a redirect plan that preserves any URL that gets traffic.

Legend: **R** retain · **I** improve (write genuine, locally relevant content: price range, process, what's included, FAQs, real photos) · **C** consolidate into the Pune page of that service (301) · **X** consider removal (redirect to the service hub) after data check.
| Service | Pune | Hadapsar | Kharadi | Undri | Amanora Park | Mohammadwadi |
|---|---|---|---|---|---|---|
| home-deep-cleaning | I | I | R | C | C | C |
| deep-cleaning | I | I | R | C | C | C |
| sofa-cleaning | I | I | R | C | C | C |
| mattress-cleaning | I | I | R | C | C | C |
| housekeeping | I | I | R | C | C | C |
| house-cleaning | I | C | R | C | C | C |
| bathroom-cleaning | I | C | R | C | C | C |
| office-cleaning | I | I | C | C | C | C |
| cleaning-services (generic) | I | C | C | X | X | X |
| window-cleaning | I | C | C | X | X | X |
| carpet-cleaning | I | C | C | X | X | X |
| bungalows-cleaning | I | C | C | X | X | X |
| mattress-steam | I | C | C | X | X | X |
Totals: **R 7 · I 19 · C 34 · X 18 = 78.** Rationale: Pune pages are the service-city hubs (must exist and be strong); Hadapsar (owner priority, Magarpatta/Hadapsar queries) keeps the six highest-value services; Kharadi keeps the seven pages that already have unique text; Undri/Amanora/Mohammadwadi have no unique content and no business case for separate pages. Mohammadwadi is an operational office location, not a customer visit address. Service-overlap note: `mattress-steam` duplicates the intent of `mattress-cleaning`. A better use of the effort is a single strong page per service with an "areas we serve" block listing localities — not new locality pages. **No live page was changed.**

## 13. Alt text and the homepage H1 (item 3)
**H1 root cause (verified in the live HTML):** the homepage has **no `<h1>` at all** (22 H2s). The visible hero line "Welcome To Sahara Cleaning Services" is an Elementor Heading widget set to H2. The 13 service/locality pages do have an H1; the 29 non-locality pages (home, /services/, /about/, /contact/ and the plain service pages such as /sofa-cleaning-shampooing/) do not.
**Proposed exact change (WordPress admin, owner approval):** in Elementor, open the hero heading → HTML Tag → **H1**; text "Home Deep Cleaning & Housekeeping Services in Pune" (or keep the welcome line and set the next heading, "Professional Cleaning Services To Keep Your Home Clean And Ready For Everything", to H1 — one H1 only). Yoast SEO title: `Deep Cleaning & Housekeeping in Pune | Sahara Cleaning` (55 chars; today's title is 160 chars and repeats "Kharadi" 4×). Meta description (≈150): `Sahara Cleaning Services, Pune: home deep cleaning, sofa and mattress cleaning, office cleaning and housekeeping. Book online or call.` Owner must confirm every claim before publishing.
**Alt text (homepage; verify against the actual picture before saving):** today 10 of 16 images have empty alt and three have Canva names ("Untitled design (52)").
| Image file | Proposed alt |
|---|---|
| sahara_logo.svg / sahara_logo-e1670325790370.png | Sahara Cleaning Services logo |
| img-1-1024x1024.jpg (hero, LCP) | Sahara Cleaning Services team cleaning a home in Pune |
| housekeeping-1.jpg | Housekeeping staff cleaning a home |
| Deep-Cleaning.png | Home deep cleaning service in Pune |
| bathroom_cleaning.jpg | Bathroom deep cleaning service in Pune |
| Untitled-design-52/54/55.webp | describe the actual photo (service + place), not the Canva name |
| 3d-rendering-luxury-scandinavian.jpg | Clean living room after deep cleaning (stock render — consider replacing with a real job photo) |
| WhatsApp-Image-2025-03-05….jpg, young-beautiful-girl….jpg | describe the photo; decorative stock images may keep empty alt |
Existing alts on shampoo/Corporate/a_image list all five localities — shorten to "Sofa cleaning and shampooing service in Pune". Priority order for the remaining ~390 images: home, services, the plain service pages, then locality pages (skip those queued for consolidation).

## 14. Tracking tags on production (item 4) and Search Console recovery (item 6)
| Hypothesis | Finding | Status |
|---|---|---|
| Missing IDs | `marketing-tags.tsx` and `/book` render **nothing** unless `NEXT_PUBLIC_GA4_ID` / `_GOOGLE_ADS_ID` / `_META_PIXEL_ID` exist. The live booking HTML contains no gtag, fbq or googletagmanager reference. The CRM page `/profit/marketing` already shows each as "not set" when it is. | Most likely cause (production env not viewable by Claude) |
| Build-time inlining | `NEXT_PUBLIC_*` values are baked into the client bundle at **build** time. The `Dockerfile` declares **no `ARG NEXT_PUBLIC_*`**, so setting them in Coolify only works if Coolify injects them as build variables for this build pack. **Unverified** — check read-only in Coolify (build pack, "Build Variable" flag) before asking for approval. A local, harmless fix is adding the ARG/ENV lines to the Dockerfile (needs deploy). | Open risk |
| Consent behaviour | No cookie/consent banner and no consent gating anywhere in `src` — once IDs exist, tags load for every visitor. Consider the India DPDP Act and Google consent-mode needs; decide before enabling (legal advice, not an engineering call). | Owner decision |
| Blocked requests | Not testable until IDs exist; ad-blockers will hide a share of visitors regardless. No CSP header is set that would block Google/Meta (booking sends only X-Frame-Options and Permissions-Policy). | No blocker found |
| Ownership/access | GA4 property: Administrator access not yet granted to Sahara; GTM-WPM2QXCX and the Pixel belong to the agency; Google Ads is Sahara's. www (WordPress) has **no analytics at all**. The only live page loading GTM is the old agency Vercel page. | Access blocked |
A local test with fake IDs was attempted but the dev server returned HTTP 500 (stale local build state); the conclusion rests on code reading plus the live HTML. **Not proven by test** — the verification test stays on the plan (section 15).

**Search Console recovery (official Google verification methods, no contact with WebBrand):** Google allows multiple verified owners of one property; verifying yourself does **not** remove the existing owner; if all owners lose verification everyone loses access. Options: (1) **DNS TXT record on saharacleaningservices.com at Namecheap** → a *Domain property* covering www, booking, app and crm (recommended; one record, no effect on web or mail; it is a DNS change → needs explicit approval, and the owner can add it himself). (2) HTML file or meta tag on www via cPanel File Manager / Yoast (live-site edit → approval). (3) GA4 or GTM verification — needs edit/publish rights we do not have. (4) For booking.* only: a meta tag in Sahara OS (needs a deploy). Whether history from before verification is visible is **not confirmed** — do not plan on it. Removing WebBrand's token afterwards is an access removal → separate approval.

## 15. Safe local implementation plan with tests (item 5) — nothing started
Order by impact/risk; each step local, tested, then approved before any deploy. URLs, rankings and booking flows must not change.
1. **Tag readiness (booking host):** add `ARG/ENV NEXT_PUBLIC_*` to Dockerfile; consent-aware loader behind a flag; tests: loader renders nothing without IDs; renders correct script with IDs; `trackLead` does not send name/phone. *Benefit:* measurement. *Risk:* none while IDs are unset.
2. **SEO regression test (`npm run test:seo`):** crawls the local public routes and asserts title ≤60, description present, one H1, canonical, JSON-LD parses, no image without alt, sitemap entries return 200, noindex only on `/landing/*`. *Benefit:* protects what already scores 100.
3. **Booking-host speed:** bundle analysis to find the 600 KiB JS on the hub, defer non-critical client code; verify with the same Lighthouse method (target LCP < 3 s, to be proven not promised); run `test:public`, `test:inquiry`, `test:pricing`.
4. **Content upgrade on booking hubs** (Hadapsar/Magarpatta section, pest warranty, painting scope, commercial FAQ); no new locality pages.
5. **AI-discoverability files:** `llms.txt` (optional), keep FAQ/LocalBusiness schema accurate (price ranges only if owner-approved — no hard-coded promo prices).
6. **www package** (WordPress changes) delivered as a checklist for owner/admin: section 11 fixes, section 13 H1/alt, section 12 consolidation after Search Console data.

## 16. AEO/GEO baseline protocol (item 7)
Recorded so far (2026-10-15, ~10:20 IST, Perplexity anonymous, one run each, results from the tool's own location logic): the 5 queries in section 3 → Sahara absent in 5/5; earlier WebSearch (US-based) → absent from own pages. **This is a small, single-platform, single-day sample; it does not represent all AI search or real Pune users.** Not yet tested: Google AI Overviews, Gemini, ChatGPT search, Bing Copilot (login/region limits). To make it a baseline: repeat the same 5 queries + 10 more (e.g. "sofa cleaning Kharadi", "mattress cleaning Pune", "move-in cleaning Pune", "housekeeping services Pune", "pest control Hadapsar", brand query "Sahara Cleaning Services Pune") monthly on the same platforms, store date/platform/query/appeared/sources/competitors in `docs/` as a table, and treat a change as real only if it persists across 3 runs.

## 17. Staging proposal review (item 8) — nothing created
Latest measurements are the 2026-10-15 readings in `CRM_LEAD_CAPTURE_PLAN.md` §11.3 (KVM 2, 2 vCPU / 8 GB / 100 GB; idle CPU ≈8 %, RAM 2.0–2.3 GB, disk ≈23.5 GB, build peak ≈34 % CPU and +17 GB disk until the 05:30 IST Docker cleanup). **They were not re-read in this phase** (the Hostinger/Coolify tabs are not in Claude's tab group); re-check immediately before any creation. Security controls required: fresh app (never cloned), own volume and DB, new AUTH_SECRET, outbound WhatsApp in TEST mode, no WhatsApp/SMS/e-mail/Sheet/VAPID variables, Basic Auth, demo passwords changed, stopped when idle. Risks to the live CRM: a build spike (temporary slowness; schedule after 23:00 IST), disk growth, and the unexplained "Restart Proxy" warning (do not restart proxy). **Verdict:** safe under those conditions, but staging is **not needed** for the SEO work — SEO/speed work is testable locally and needs staging only if the owner wants a shareable pre-production preview. Approval needed before creation (A/B/C decision still open).

## 18. Consolidated priorities
| # | Issue | Evidence | Fix | Expected benefit | Risk | Cost | Approval |
|---|---|---|---|---|---|---|---|
| 1 | No measurement (no tags, no Search Console, no www analytics) | live HTML; code | Search Console TXT; GA4 access; Dockerfile ARG + IDs; consent decision | knowing which pages bring leads | low; DPDP/consent choice | ₹0 | DNS/ID/deploy |
| 2 | www LCP 9.5 s | Lighthouse | images, caching, plugin trim (§11) | faster page, better conversion/CWV | Elementor breakage | ₹0 | WordPress change |
| 3 | 65 identical locality pages | text comparison | consolidate/improve (§12) | less cannibalisation, stronger hubs | losing traffic if done blind | ₹0 | redirects |
| 4 | Homepage no H1, bad title/alt | live HTML | §13 | clearer topic signal | low | ₹0 | WordPress change |
| 5 | Absent from AI answers | 5 queries | strong service pages + consistent listings + reviews | possible citations (unproven) | none | ₹0 | GBP/listings |
| 6 | Booking-host JS/LCP 4.5 s | Lighthouse | bundle trim (§15.3) | faster landing | regression | ₹0 | deploy |
