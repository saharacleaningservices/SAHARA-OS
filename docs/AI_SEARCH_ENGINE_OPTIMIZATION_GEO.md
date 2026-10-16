# AI search visibility (GEO) — Gemini, ChatGPT search, Perplexity (2026-10-16)

**Goal:** when someone asks an AI assistant "who does deep cleaning in Pune?", Sahara Cleaning Services is known,
described correctly and linked to its booking page. **No one can guarantee** an assistant will rank or recommend a
business "top" — these systems choose answers themselves. What Sahara controls: accurate, consistent, machine-readable
facts and credible third-party mentions. Nothing here makes or implies unverifiable claims.

## 1. How the assistants find businesses (simplified)
| Assistant | Main sources it draws on |
|---|---|
| Google Gemini / AI Overviews | Google's search index, Google Business Profile (Maps), structured data |
| ChatGPT search | Web search results (largely Bing's index), sites it can crawl, well-known directories |
| Perplexity | Its own crawler plus web search results; cites the pages it used |
| All of them | Consistent facts across many independent sites (website, Maps, directories, reviews, news) |

## 2. Done in Sahara OS (branch `feat/geo-ai-search`, stacked on release PR #5)
| Change | Why |
|---|---|
| `src/lib/seo-schema.ts` — one business JSON-LD builder used on every public page: name, slogan "Serving Pune Since 2012", address, **geo coordinates**, **Google Maps link**, phones, e-mail, founding year, service area (Pune, PCMC), `knowsAbout`, and a **service catalogue** linking each service to its page | Machines read facts directly instead of guessing from page text; one source keeps name/address/phone identical everywhere |
| `public/llms.txt` on booking.saharacleaningservices.com | A plain-text fact sheet some AI crawlers read (an emerging convention — helpful, not a guarantee) |
| No prices and no self-published star ratings in the schema | Prices change (festival offers) and need owner approval; self-published ratings are not eligible for Google review results |
| Already in place: sitemap.xml, robots.txt allowing crawlers on booking.*, canonical URLs, FAQ schema, indexable service pages, true 404s | Crawlable, unambiguous pages |

Tests: `npm run test:geo` (4/4) checks the schema facts, the absence of prices/ratings/superlatives and llms.txt.

## 3. Owner actions (highest impact first — these matter more than code)
1. **Google Business Profile accuracy** — name, category "Cleaning service", hours, services, photos, booking link
   `https://booking.saharacleaningservices.com/booking`. **NAP check:** the CRM uses the Magarpatta City address
   (411028) and phones 70833 47130 / 89565 67130; a second "in Pune" profile lists PIN 411060 and 89565 67130. Different
   addresses/phones across profiles confuse assistants — decide which profile is the main one (no change made by Claude).
2. **Reviews:** keep asking real customers for Google reviews (the booking-confirmation message has a Google Review
   button). Never buy or script reviews.
3. **Google Search Console + Bing Webmaster Tools** for `booking.saharacleaningservices.com`: verify (DNS TXT in
   Namecheap), submit `sitemap.xml`. Bing matters because ChatGPT search relies heavily on web search results.
4. **Directory consistency:** Justdial, Sulekha, IndiaMART, Facebook page, Instagram bio — same name, address, phone,
   website. Fix any old numbers.
5. **Independent mentions:** local news, community/society newsletters, partner sites (builders, property managers).
   These also help the WhatsApp green-tick request.
6. **Main website (after the planned migration):** add the same JSON-LD and an `<h1>`; until then WordPress stays as is.

## 4. Monthly check (10 minutes)
Ask each assistant, in a fresh/private session, and note whether Sahara appears, which facts it states and which page it cites:
- "Who offers home deep cleaning in Pune?"
- "Deep cleaning service near Magarpatta / Hadapsar / Kharadi"
- "Sahara Cleaning Services Pune phone number and address"
- "Pest control in Pune with pay after service"
Wrong facts → find which site the assistant cited and correct it there.
