# Main website + public domains — technical SEO check (2026-10-16, read-only)

Checked from outside with curl and PageSpeed Insights (mobile). Nothing was changed on WordPress,
DNS, cPanel or Coolify.

## 1. "0+ Years" counters on saharacleaningservices.com (WordPress + Elementor, Astra theme)
**Not part of Sahara OS** — the main site is WordPress on cPanel. Sahara OS pages already say
"Serving Pune Since 2012".

Cause: the Elementor **Counter** widgets are sent as `0` (`data-from-value="0"`) and count up with
JavaScript only when scrolled into view. Search engines, WhatsApp/Facebook link previews, slow phones
and any speed plugin that delays JavaScript see **"0+ Years"**, "0+ Happy Customers", etc.
Also: the counter target is **16** years, but "Since 2012" = **14** years in 2026.

Owner / website admin steps (WordPress → Pages → Home → Edit with Elementor):
1. Click the "Years Of Experience" counter → delete it → drag a **Heading** widget in its place →
   text **"Serving Pune Since 2012"** (never goes stale, never shows 0).
2. For the other counters (Expert Team 50+, Happy Customers 900+, Projects Finished …): either replace
   each with a Heading ("900+ Happy Customers") **or** set **Starting Number = Ending Number** in each
   Counter's settings so the HTML already contains the real number. Use only figures you can stand behind.
3. Update → clear the cache plugin (if any) → open the page in a private window and on a phone.
4. Check with "View page source" (Ctrl+U): the numbers must appear in the source, not `0`.

## 2. HTTPS and redirects
| URL | Result | Verdict |
|---|---|---|
| `http://saharacleaningservices.com` | 301 → `https://www.saharacleaningservices.com/` | OK |
| `http://www.saharacleaningservices.com` | 301 → https www | OK |
| `http://app.saharacleaningservices.com` | **302** → https | Should be 301 (Coolify/Traefik redirect setting, not app code) |
| `http://booking.saharacleaningservices.com` | **302** → https | Should be 301 (same) |
| `https://booking…/` | 307 → `/book` | OK (app route) |
| `https://crm…/` | 307 → `/login` | OK (private app) |

Certificates (Let's Encrypt): `*.saharacleaningservices.com` expires **1 Nov 2026** (16 days);
`app.saharacleaningservices.com` expires 7 Dec 2026. **Owner action:** cPanel → SSL/TLS Status →
confirm AutoSSL renews the wildcard (or run AutoSSL now). If it fails, the main site shows a security
warning from 1 Nov.

`app.` is intentionally non-indexable (`robots.txt: Disallow: /`, canonical → `booking.`); the
indexable public domain `booking.` has its own robots.txt and sitemap.xml. Correct.

## 3. Mobile PageSpeed (Lighthouse, 2026-10-16)
| Page | Performance | Accessibility | Best practices | SEO | LCP |
|---|---|---|---|---|---|
| www.saharacleaningservices.com (WordPress) | **66** | 85 | 100 | 92 | 5.3 s lab · **8.9 s real users** (Core Web Vitals: failed) |
| booking.…/home-deep-cleaning-pune (Sahara OS) | **70** | 97 | 100 | **100** | 6.6 s |
| app.…/home-deep-cleaning-pune | 70 | 97 | 100 | 69 (blocked from indexing — intended) | 6.8 s |

Target > 90 is **not met** on either site.
- Sahara OS (`booking.`): largest wins are image delivery (logo PNG 84 KB → fixed on branch
  `feat/public-site-fixes`, 29 KB; hero `hero-home.webp` 142 KB could save ~46 KB), unused/legacy
  JavaScript and the request chain. Also flagged: one colour-contrast issue, `llms.txt` recommendations
  and an invalid `ai-catalog.json` schema. Needs a focused performance pass + re-measure after deploy.
- WordPress: image optimisation (WebP, correct sizes), a caching plugin, fewer Elementor add-ons —
  website admin work on cPanel.
