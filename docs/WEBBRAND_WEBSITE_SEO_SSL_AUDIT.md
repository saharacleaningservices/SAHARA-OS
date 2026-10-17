# www.saharacleaningservices.com — read-only SEO / website / SSL audit (17 Oct 2026)

Prepared for WebBrand to implement. **Nothing on the website, hosting, database, DNS or SSL was changed** — only public
pages were requested over HTTP. Measured from outside (Pune, desktop + mobile user-agent). PageSpeed Insights could not be
used (daily quota exceeded), so speed figures below are curl timings, not Lighthouse scores.

## 1. SSL / HTTPS (status: OK today, expires 1 Nov 2026)
| Check | Result |
|---|---|
| Certificate | Let's Encrypt, valid until **1 Nov 2026 11:01 UTC**, covers `www` and the bare domain (same expiry) |
| Auto-renewal | Not renewed yet with 15 days left → AutoSSL / certbot renewal is probably failing or off |
| HTTP → HTTPS | `http://` and bare domain both 301 → `https://www.` (correct, single hop) |
| Mixed content | None found on the homepage |
| HSTS | **Missing** (no `Strict-Transport-Security` header) |
Action: renew now, send the new expiry date, then add HSTS once renewal is reliable.

## 2. Findings, highest impact first
| # | Priority | Finding (evidence) | Recommended fix |
|---|---|---|---|
| 1 | High | **No analytics, ad or conversion tags** on the site (no GA4, GTM, Google Ads, Meta Pixel in the HTML). Ads traffic landing here cannot be measured | Install GA4 (`G-74EZWDS33Z`) and, when the owner confirms, the Meta Pixel; share access with Sahara |
| 2 | High | **No booking path.** Homepage has call links (tel:) but no link to `https://booking.saharacleaningservices.com/booking` | Add "Book Now / Check slots" buttons (header + hero + services) → booking URL with `?utm_source=website&utm_medium=cta` |
| 3 | High | **Homepage title + description are keyword-stuffed and too long**: "…Services in Kharadi, House Cleaning… in Kharadi, Deep Cleaning… Kharadi, Housekeeping… Kharadi, Pune" (~150 chars) | Title ≤ 60 chars, e.g. "Home Deep Cleaning & Housekeeping in Pune \| Sahara Cleaning Services"; description 140–155 chars with phone/CTA |
| 4 | High | **Slow server response**: 1.3–2.1 s TTFB on every page (mobile UA 1.49 / 1.49 / 1.53 s); once 5.6 s on the bare-domain http request | Page/object cache (LiteSpeed/WP Rocket or server cache), PHP 8.x, check hosting resources and plugin load |
| 5 | High | **No H1 on the homepage or on /services/, /about/, /contact/, /photo-gallery/, /privacy-policy/** | One descriptive H1 per page (e.g. "Home Deep Cleaning Services in Pune") |
| 6 | Medium | **Inner pages have no meta description** (5 of 5 checked) and generic titles ("Services - Sahara Cleaning Services") | Unique title + description per page via Yoast; separate pages per service (home deep cleaning, office/commercial, housekeeping/AMC, pest control, interior painting) |
| 7 | Medium | **No browser caching headers** on CSS/JS/images (no `Cache-Control`/`Expires`; only `Last-Modified`) | Set far-future cache (e.g. 1 year, versioned) for static assets |
| 8 | Medium | **Heavy page**: 45 stylesheets + 22 scripts; HTML 228 KB (59 KB gzipped — compression works); two PNGs ~550 KB (`a_image.png` 555 KB, `Deep-Cleaning.png` 543 KB) | Convert to WebP/AVIF, resize to display size, lazy-load below the fold, combine/defer CSS and JS, remove unused Elementor/Astra assets |
| 9 | Medium | **Image alt text missing on 10 of 16 homepage images** | Descriptive alt text (service + Pune) on all content images |
| 10 | Medium | **Structured data is generic** (Organization, WebSite, WebPage only). No LocalBusiness / Service data | Add LocalBusiness (name, phone, address, `areaServed` Pune & PCMC, opening hours, `sameAs` profiles) and Service entries; do not add ratings/prices that are not shown on the page |
| 11 | Medium | **Security headers missing**: HSTS, `X-Content-Type-Options`, `X-Frame-Options`/CSP frame-ancestors, `Referrer-Policy`, `Permissions-Policy` | Add at server/.htaccess level |
| 12 | Low | `<meta name="generator">` exposes WordPress 7.0.7 and Elementor 3.27.5 | Remove generator tags; keep core/theme/plugins updated |
| 13 | Low | Homepage has 1 `og:title` but no per-page social images checked | Set Open Graph image per key page |

## 3. Already fine
- Canonical tag present and pointing to `https://www.…`; bare domain 301s to www.
- `robots.txt` allows crawling and lists `sitemap_index.xml` (Yoast); sitemap returns 200 with page + header/footer sitemaps.
- Unknown URLs return a real 404.
- Mobile viewport meta present; gzip compression enabled; tel: links use the correct numbers (+91 70833 47130, +91 89565 67130).

## 4. Local SEO notes (not WebBrand's work, for context)
Google Business Profile lists two verified Sahara profiles with different addresses (Hadapsar 411028 and Hadapsar
411060). The website, both profiles and the booking site must use one consistent name/address/phone. The owner decides
which profile is primary.

## 5. Out of scope / not touched
Website files, WordPress settings, database, DNS, hosting, SSL, the post-Diwali migration plan.
