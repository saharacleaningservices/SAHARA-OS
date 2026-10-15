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
Booking host: canonicals, H1, alt text, sitemap and robots are correct, but **titles are 72–86 characters and several descriptions exceed 160** (truncated in results) — see section 19D.

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
| Build-time inlining | `NEXT_PUBLIC_*` values are baked into the client bundle at **build** time and the `Dockerfile` had no `ARG` lines. **Evidence that the platform already passes build variables:** the live sitemap lists `booking.saharacleaningservices.com` URLs although it is prerendered at build and the Dockerfile has no `ARG BOOKING_URL` (a local build without `BOOKING_URL` emits `app.*`). So Coolify injects build-time variables; set the IDs as Coolify *build-time* variables and redeploy. Still unproven for these four names until tried; see section 19 for the added `ARG` safety net. | Low risk, confirm at rollout |
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

---
# Phase 3 update (2026-10-15) — local-only technical work (uncommitted)
Authorised: local work only. Nothing deployed, no Coolify/DNS/env/WordPress change, no real tracking IDs, nothing published. Files changed (uncommitted): `Dockerfile`, `package.json` (+1 script), `tests/seo.test.ts` (new); docs.

## 19. Findings
**A. Build-time tracking variables (item 1).** `NEXT_PUBLIC_*` are inlined at `next build`. Added to the builder stage of the `Dockerfile`: `ARG NEXT_PUBLIC_GA4_ID`, `_GOOGLE_ADS_ID`, `_GOOGLE_ADS_LEAD_LABEL`, `_META_PIXEL_ID` (ARG only, no ENV → unset stays unset and nothing reaches the runner stage; the IDs are public, not secrets). *Not tested with Docker (Docker is not installed on this PC).* **Safest rollout configuration (needs approval, not done):** (1) get Sahara-owned GA4 / Ads / Pixel access first (section 14); (2) add the four IDs in Coolify as **build-time** variables; (3) one redeploy; (4) verify in a browser (network: `gtag/js?id=`, `fbevents.js`) and in GA4 Realtime / Meta Test Events; (5) decide on a consent mechanism before enabling for all visitors; (6) rollback = remove the variables and redeploy. Never use the agency's GTM container (GTM-WPM2QXCX).
**Local proof with fake IDs** (`G-TESTTEST00`, `AW-000000000`, `0000000000`; scratch DB copy; Turbopack dev server): in a real browser the landing page loaded `gtag/js`, `dataLayer` held `config` for both IDs, `fbq` was defined and `fbevents.js` loaded. With IDs unset, nothing loads (the new test checks this). Side effect: the fake Ads ID made the browser contact Google (`googleads.g.doubleclick.net … AW-000000000`), so never use real IDs in local tests.

**B. HTTP 500 diagnosed (item 4).** Cause: the dev server had been started with `npx next dev` (webpack) instead of the project's `npm run dev` (`next dev --turbopack`). Under webpack the instrumentation compile fails — `Module not found: Can't resolve 'http'` from `agent-base` ← `web-push` ← `src/lib/webpush.ts` ← `notify.ts` (reached via `ops-reminders` / `backup-health` in `src/instrumentation.ts`) — and every page returns 500. With `npm run dev` the same page returns 200 (first compile 29 s). Production builds use `--turbopack` and the production build passed, so production is unaffected; webpack mode is simply unsupported. Not a regression from this work.

**C. Booking hub JavaScript (item 3) — the "600 KiB" is mostly Google Maps, not Sahara code.** Lighthouse request breakdown for `/home-deep-cleaning-pune` (913 KiB, 42 requests):
| Host | Requests | Transfer |
|---|---|---|
| booking.saharacleaningservices.com (Sahara HTML, CSS, JS, images) | 24 | 455 KiB |
| **maps.googleapis.com + maps.gstatic.com (Google Maps embed)** | **15** | **456 KiB** |
| other google.com | 3 | ~2 KiB |
Source: the footer `<iframe src="https://www.google.com/maps?…&output=embed" loading="lazy">` in `src/components/public/campaign-kit.tsx` (`CampaignFooter`, used by the hub, commercial, pest and painting pages). On a short mobile page Chrome loads "lazy" iframes early, so the whole Maps application downloads on first visit.
**Sahara's own JavaScript:** 15 chunks, ~655 KiB uncompressed / **~203 KiB gzip**; React/Next runtime is the bulk; the only identifiable app chunk is the booking wizard + price selector (~72 KiB raw / 19 KiB gzip), imported eagerly by `landing-kit.tsx`. Production chunks are minified without module names, so this split is by content markers, not exact.
**Proposed minimal changes (not implemented):**
1. *Map facade* in `CampaignFooter`: a static "View on Google Maps" card (address + the existing Google Business Profile link from `marketing-content.ts`) that mounts the iframe only on tap. Expected: **−456 KiB (about −50 % page weight) and −15 requests per visit**; no change to first-party JS, booking, CRM, pricing or tracking. Risk: map not visible until tapped; local-SEO signals (address text, LocalBusiness JSON-LD, GBP link) unchanged; check mobile layout.
2. Load `BookingWizard` with `next/dynamic` where it is below the fold or behind a button: ~19 KiB gzip. Only after confirming it does not delay the booking flow; rerun `test:public`, `test:pricing`, `test:inquiry` plus a manual booking E2E.
3. Do not touch the React/Next runtime, icons or tracking code for size: no worthwhile gain for the risk.
**LCP effect is unproven.** Repeat Lighthouse runs on the same live URL gave performance 83, 81 (first pair) and 81, 59 (second pair), LCP 3.7–6.8 s, versus 69 / 4.5 s earlier: run-to-run noise exceeds any small gain. Judge the change by transferred bytes, request count and the median of ≥5 runs. My attempt to block the Maps hosts inside Lighthouse did not take effect (request count unchanged), so no "after" number exists.

**D. Correction to section 6.** Booking-host titles are 72–86 characters (Google shows ~60) and descriptions go up to 282 characters (shown ~160) — 25 advisory items are printed by the new test. `/gallery` has a 41-char title, 70-char description and no structured data. Proposed: shorten title templates (keyword and price first, brand last; titles embed live pricing, so keep them data-driven). Wording needs owner approval.

## 20. `npm run test:seo` (item 2)
`tests/seo.test.ts`, node:test + tsx like the other suites. It starts the already-built app with `next start` on a free port, with a throwaway DB, `BOOKING_URL` / `CRM_URL` set to the production hosts and tracking IDs empty, then checks:
1. sitemap = exactly the 14 indexable paths, one origin, no duplicates, none of `/landing /api /my /login /j`;
2. robots: booking host allows `/` and blocks `/api/ /j/ /my /login /uploads/`, lists the sitemap; any other host disallows everything;
3. each page: 200, indexable, unique title (20–90 chars), description (50–300), self-canonical;
4. exactly one H1, it is the first heading, no skipped levels, no empty headings;
5. JSON-LD parses and keeps `HomeAndConstructionBusiness` (+ `FAQPage` on service pages);
6. every `<img>` has an alt attribute;
7. the four `/landing/*` pages stay noindex;
8. important routes stay 200, `/privacy` → 308 `/privacy-policy`, `/book?…` → 307 `/booking` with UTM and `service=` carried over;
9. CRM routes (`/dashboard /leads /jobs /payments /settings /api/backup`) are not 200 on the booking host;
10. no Google/Meta/GTM script while IDs are unset.
Advisory only (printed, never failing): titles >60, descriptions >160, sitemap origin not the booking host. `SEO_STRICT_ORIGIN=1` makes the origin check a failure for pre-release use. **Finding while writing it:** the sitemap is prerendered at build time (canonicals are computed per request), so a build without `BOOKING_URL` silently emits `app.*` URLs. Needs `npm run build` first (fails with a clear message otherwise). Limits: static HTML only (no JavaScript rendering), localhost only.

## 21. Commands and results (2026-10-15, branch feat/backup-alerts)
| Command | Result |
|---|---|
| `npm run build` (Turbopack, no tracking IDs) | exit 0 (existing ESLint warnings only) |
| `npm run test:seo` | 10/10 pass, 25 advisory items printed |
| `SEO_STRICT_ORIGIN=1 npm run test:seo` (same build) | 9 pass, 1 fail as designed ("sitemap origin app.* — rebuild with BOOKING_URL=…") — shows the suite can fail |
| `npx tsc --noEmit` | exit 0 |
| `test:public` 5/5 · `test:pricing` 61/61 · `test:inquiry` 15/15 · `test:ops` 7/7 · `test:eod` 16/16 · `test:backup` 10/10 | pass |
| `npm run dev -- -p 3098` + browser check with fake IDs | 200; gtag, dataLayer, fbq verified |
| `npx next dev` (webpack mode) | 500, explained in 19B |
Not run: Docker build (no Docker), a build with fake IDs, a Lighthouse "after" measurement (nothing implemented). Local test servers on ports 3097–3099 were stopped.

## 22. Risks and next approval
Risks: the Dockerfile ARG lines are untested in Docker (harmless if unused; revert = delete 4 lines); `test:seo` adds ~25 s and needs a prior build; it locks current routes, so an intentional route change must update the test. **Next approval needed — choose one:** (a) commit these three files locally (no push); (b) implement the map facade and optional wizard lazy-loading locally with before/after byte counts and tests; (c) anything that deploys, adds tracking IDs, touches DNS or WordPress stays blocked until separately approved.

---
# Phase 4 update (2026-10-15) — map-on-tap implemented locally and committed locally (not pushed, not deployed)
## 23. Change
`src/components/public/map-on-tap.tsx` (new client component) replaces the always-loading footer `<iframe>` in `CampaignFooter` (`src/components/public/campaign-kit.tsx`). Until the visitor taps **"Show map here"** the footer shows a static card: address, a clear **"View on Google Maps"** link (opens the existing Google Business Profile listing `GOOGLE_MAPS_URL`, `target=_blank`, `rel="noopener noreferrer"`) and the button. The card has the same height classes as the map, so layout does not jump (CLS 0 in every run). Pages affected: home-deep-cleaning-pune, commercial-cleaning-pune, pest-control-pune, interior-painting-pune. No tracking, consent, pricing, booking-form or CRM code was touched; no environment variable or tracking ID was added.
Verified in a real browser (local production build): before the tap 0 iframes and 0 Maps requests; after the tap the iframe mounts (360 px high on desktop) and exactly one Maps request starts; mobile (375 px) shows the card without horizontal overflow. New test 10 in `npm run test:seo` guards it (it fails on today's live page, which still has the iframe).

## 24. Before / after (measured, local)
Method: Lighthouse CLI, mobile emulation, simulated throttling, Chrome headless on this PC, URL `http://localhost:3090/home-deep-cleaning-pune` served by `next start` from the local production build (scratch DB copy), 5 runs "before" (build of the unmodified code) then 5 runs "after" (build with the change), one after the other (not interleaved); real Google servers for third-party requests.
| Metric (median of 5) | Before | After | Change |
|---|---|---|---|
| Requests | 42 | 24 | −18 (−43 %) — measured, identical in all 5 runs |
| Transferred | 924.8 KiB | 467.6 KiB | −457 KiB (−49 %) — measured |
| Google Maps requests / KiB | 17 / 458 | 0 / 0 | measured |
| Script transfer | 607.8 KiB | 174.9 KiB | −433 KiB — measured |
| Performance score | 56 (runs 74, 56, 71, 52, 51) | 86 (runs 68, 87, 88, 75, 86) | +30 median, runs overlap (68–74) |
| LCP | 6.65 s (3.9, 6.7, 5.3, 6.8, 6.7) | 3.53 s (3.7, 3.5, 3.5, 3.5, 3.5) | −3.1 s median |
| FCP | 3.69 s | 1.32 s | |
| TBT | 401 ms | 225 ms | very noisy (65–576 vs 174–787) |
| CLS | 0 | 0 | |
**Reading the evidence:** bytes and request counts are exact and repeatable (they barely moved between runs). The LCP/score improvement is *consistent* — all 5 "after" runs had LCP ≤ 3.7 s while 4 of 5 "before" runs were ≥ 5.3 s — and plausible, because the 15–17 Maps requests compete for the same slow simulated connection as the hero image. But it is a **lab result from one machine, one URL, sequential runs**: absolute values are not what a customer in Pune on a real phone sees. Earlier runs against the live site varied between 59 and 83 for the unchanged page, so treat "+30 points" as indicative, not a promise. No field (real-user) data exists yet; after a deploy, compare Search Console / Chrome UX data (once owned) or repeat this same method on the live URL. Estimated, not measured: effect on conversions (none claimed).

## 25. Booking-wizard lazy loading — evaluated, NOT implemented
Measured size of the wizard chunk: ~72 KiB uncompressed / ~19 KiB gzip, i.e. about 2 % of the page's 925 KiB (4 % of the remaining first-party transfer). In this app the wizard is server-rendered inside `QuoteSection`; truly deferring it needs a client wrapper with `ssr:false` (or an on-scroll trigger), which (a) removes the form's server-rendered HTML for crawlers and no-JS visitors, (b) can shift the layout and break `#book` / `#price-selector` anchor jumps, and (c) touches validation, pricing props, tracking and navigation of the page's main conversion element. The possible gain (≤ 19 KiB gzip) is below the noise of the measurements above, so the risk is not justified. Decision: keep the wizard as is. Reconsider only if bundle analysis after deployment shows it blocking input responsiveness.

## 26. Test results (after the change, 2026-10-15)
| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `BOOKING_URL=https://booking.saharacleaningservices.com CRM_URL=https://crm.saharacleaningservices.com npm run build` | exit 0 (existing ESLint warnings only) |
| `SEO_STRICT_ORIGIN=1 npm run test:seo` | 11/11 |
| `test:public` 5/5 · `test:pricing` 61/61 · `test:inquiry` 15/15 · `test:ops` 7/7 · `test:eod` 16/16 · `test:backup` 10/10 | pass |
Not run: Docker build (no Docker on this PC); a full booking submission E2E (the change is footer-only and does not touch the wizard, form actions, pricing or tracking — verify once on staging/after deploy). Test servers on ports 3090–3099 stopped.
**Remaining risks:** visitors must tap to see the interactive map (the address and a direct Google Maps link are visible); the Dockerfile `ARG` lines are untested in Docker; results above are lab numbers. **Next approval needed:** push of the local commit and any deployment (production deploy is a separate owner decision; suggested: staging first or off-peak small deploy with `git revert` as rollback).
