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
2. **www is slow** — Lighthouse mobile (home): performance **45**, LCP **9.5 s**, FCP 4.9 s, TBT 570 ms, CLS 0.001, accessibility 85, SEO 92. Likely heavy images/plugins. [Verified for 1 URL only]
3. **Near-duplicate locality pages on www** — 78–79 service×locality pages, avg cross-locality text similarity ~0.69, up to 0.91 → cannibalisation/doorway risk.
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
