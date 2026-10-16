# saharacleaningservices.com — speed, SEO and Brand Make cleanup audit (2026-10-16)

Read-only, from outside (curl, public DNS, PageSpeed Insights). Claude did **not** log in to cPanel, WordPress or
Namecheap and changed nothing. The WordPress site, its database and `.htaccess` were not touched.

## 1. Snapshot
| Item | Finding |
|---|---|
| Hosting | cPanel, Apache, `192.185.129.241` (HostGator — SPF include `websitewelcome.com`) |
| CMS | WordPress 7.0.7, Astra theme, Elementor 3.27.5, Yoast SEO 26.9 |
| Plugins seen in the HTML | brave-popup-builder, elementor, essential-addons-for-elementor-lite, header-footer-elementor, mystickyelements, qi-addons-for-elementor, sticky-header-effects-for-elementor |
| DNS | Namecheap (`registrar-servers.com`) |
| Mobile PageSpeed (16 Oct) | Performance **66**, Accessibility 85, Best practices 100, SEO 92; LCP 5.3 s (lab), **8.9 s real users** — Core Web Vitals **failed** |

## 2. Speed — findings and fixes (priority order)
| # | Finding (measured) | Why it matters | Fix (website admin, in WordPress/cPanel) |
|---|---|---|---|
| 1 | **Server response (TTFB) 5.8 s** on a cold request, ~1.7 s repeated; no page-cache headers | Every visitor waits before anything loads; Google counts it | Install **one** page-cache plugin. On Apache/HostGator: *WP Super Cache* or *W3 Total Cache* (page cache + browser cache). If the host offers LiteSpeed, use *LiteSpeed Cache* instead. Then re-test: target TTFB < 0.8 s |
| 2 | **HTTP/1.1** | Many files load one after another | Ask hosting support to enable HTTP/2 (or put the site behind Cloudflare's free plan — that also needs a DNS change in Namecheap, owner decision) |
| 3 | **45 stylesheets + 22 external scripts** on the home page | Render-blocking; slow on phones | Remove add-ons you don't need (the site loads **4 Elementor add-on packs**: Essential Addons, Qi Addons, Header-Footer, Sticky Header Effects — keep only what the pages use); in the cache plugin enable CSS/JS combine + defer JS; Elementor → Settings → Features → enable "Improved CSS loading" and "Improved asset loading" |
| 4 | Google Fonts: **Poppins (4 weights) + Roboto (all 18 weights incl. italics)** | ~2 render-blocking font requests, large downloads | Elementor → Settings → Google Fonts: load only the weights used (e.g. 400/600/700), or switch to "Load locally"; drop Roboto if the design uses Poppins |
| 5 | Popup builder + sticky elements plugins | Extra JS on every page | Keep only if they generate leads; otherwise deactivate |
| 6 | Images: 16 on the home page, only 8 lazy-loaded | Above-the-fold images compete with the hero | Use WebP (a plugin such as *Converter for Media*), lazy-load below-the-fold images, set the hero image to "high priority" (Elementor image widget) |
| 7 | No security headers (HSTS, X-Frame-Options) | Not speed, but best practice | Add via the cache/security plugin or `.htaccess` (only with a backup; website admin) |

Re-measure after each step at pagespeed.web.dev (mobile). Expected: Performance 80+ after #1–#4.

## 3. SEO — findings and fixes
| # | Finding | Fix (Yoast / Elementor) |
|---|---|---|
| 1 | **No `<h1>` on the home page** | Make the main hero heading an H1 (Elementor heading widget → HTML tag H1), e.g. "Home & Office Deep Cleaning in Pune — Serving Pune Since 2012" |
| 2 | **Title is keyword-stuffed (150+ chars) and only about Kharadi**: "We provide Home Deep Cleaning Services in Kharadi, House Cleaning Services in Kharadi, …" | Yoast → Home page SEO title (≤ 60 chars), e.g. "Deep Cleaning Services in Pune \| Sahara Cleaning Services" |
| 3 | Meta description repeats the title | ≤ 155 chars, benefit-led, e.g. "Home, office & sofa deep cleaning across Pune & PCMC. Trained in-house staff, transparent prices, pay after service. Serving Pune since 2012." |
| 4 | Structured data: Organization only (no LocalBusiness) | Yoast → Settings → Site representation → Organization + add address/phone; or Yoast Local SEO; Sahara OS booking pages already publish LocalBusiness schema |
| 5 | **"0+ Years" counter** (Elementor counter starts at 0; target value 16 — "since 2012" = 14 in 2026) | Replace with a heading "Serving Pune Since 2012" (owner-approved wording); see `docs/MAIN_WEBSITE_TECH_SEO_2026-10-16.md` |
| 6 | Robots, sitemap, canonical | ✅ Yoast robots.txt + `sitemap_index.xml` (200), canonical set, `index, follow` |
| 7 | SSL | Wildcard certificate expires **1 Nov 2026** and has not auto-renewed — run cPanel AutoSSL for domain + www (`docs/URGENT_OWNER_ACTIONS_2026-10-16.md`) |

## 4. Brand Make landing page — what exists and how to clean up safely
**Finding:** the Brand Make page is **`promo.saharacleaningservices.com`**, served from a **different server**
(`82.180.143.191`, LiteSpeed — not Sahara's cPanel `192.185.129.241`). There are **no Brand Make files in Sahara's
cPanel to back up or delete** (none are linked from the WordPress site). What Sahara controls is one **DNS A record**
in Namecheap (`promo` → `82.180.143.191`). The page loads Google Tag Manager **GTM-WPM2QXCX** (owner unknown, outside
Sahara's Google account) and its Call/WhatsApp buttons go to **8956567130**. It was the final URL of the old Google Ads
campaigns (≈₹90k spend, per `docs/OWNERSHIP_RECOVERY_PLAN.md`).

Safe order (owner):
1. **Keep a copy of the page:** open https://promo.saharacleaningservices.com → Ctrl+S "Web page, complete", or print to
   PDF (it is a page on someone else's server; this is your record of it).
2. **Google Ads first:** change every ad's Final URL from `promo.` to
   `https://booking.saharacleaningservices.com/landing/home-deep-cleaning-pune` (and the other `/landing/*` pages) —
   only after PR #5 is live and a tagged test lead is verified (`docs/ads-audit-east-pune.md` §4d).
3. **Then retire the subdomain** (Namecheap → Advanced DNS → record `promo` A `82.180.143.191`):
   - *Recommended:* change it to point at the Sahara VPS (`187.53.134.175`) and add `promo.saharacleaningservices.com`
     as a domain in Coolify with a 301 redirect to `booking.saharacleaningservices.com` — old links and bookmarks keep
     working. Claude can add the redirect code once you decide.
   - *Or:* delete the record (old links then fail).
4. Rollback: put the A record back to `82.180.143.191`.
Do not delete anything before step 2 — active ads or shared links would break.
