# Search Console: Batch 1 baseline and monitoring (2026-11-04)

Property: Domain property `saharacleaningservices.com`. Batch 1 = Mohammadwadi, Undri, NIBM Road, Kondhwa, Hadapsar, Magarpatta, Kharadi.
Take the baseline BEFORE deploy, export as CSV and date it. Dates below assume a baseline window of the last 90 days ending 2026-11-03; adjust to the actual export day.

## Page filters (Performance → Search results → + New → Page → Custom (regex))

| Purpose | Filter type | Regex |
|---|---|---|
| Old Batch 1 URLs (baseline) | Custom (regex), "Matches regex" | `.*/pune/(mohammadwadi\|undri\|nibm\|kondhwa\|hadapsar\|magarpatta\|kharadi)$` |
| New Batch 1 URLs (after deploy) | Custom (regex), "Matches regex" | `.*/cleaning-services-(mohammadwadi-411060\|undri-411060\|nibm-road-411048\|kondhwa-411048\|hadapsar-411028\|magarpatta-411028\|kharadi-411014)$` |
| Old + new combined (single series per batch) | Custom (regex), "Matches regex" | `.*/(pune/(mohammadwadi\|undri\|nibm\|kondhwa\|hadapsar\|magarpatta\|kharadi)\|cleaning-services-(mohammadwadi-411060\|undri-411060\|nibm-road-411048\|kondhwa-411048\|hadapsar-411028\|magarpatta-411028\|kharadi-411014))$` |
| Single locality, e.g. Kharadi | Custom (regex) | `.*/(pune/kharadi\|cleaning-services-kharadi-411014)$` |
| Batch 2 (later) | Custom (regex) | `.*/(pune/(viman-nagar\|wagholi\|baner\|wakad\|hinjewadi\|aundh\|kothrud)\|cleaning-services-(viman-nagar-411014\|wagholi-412207\|baner-411045\|wakad-411057\|hinjewadi-411057\|aundh-411007\|kothrud-411038))$` |
| Net-new 8 pages | Custom (regex) | `.*/cleaning-services-(amanora-411028\|bavdhan-411021\|wanowrie-411040\|katraj-411046\|deccan-411004\|erandwane-411004\|shivajinagar-411005\|camp-411001)$` |

Search Console regex uses RE2 and must match the whole URL, hence the leading `.*` and trailing `$`. In the UI paste the `\|` as a plain `|`; the backslash is only for this Markdown table.
Plain (non-regex) alternative: Page → "URL contains" → `/pune/mohammadwadi`, one locality at a time.

## Settings
- Metrics: Clicks, Impressions, CTR, Average position (all four ticked).
- Dimensions to tab through: Pages, Queries, Devices.
- Country: India. Search type: Web.
- Compare: Last 28 days vs Previous period; custom range from deploy day (T0) to today.
- Export: Export → Download CSV for Pages and Queries; name `gsc_batch1_baseline_YYYYMMDD.csv`.
- Indexing → Pages: filter by sitemap (all submitted pages); watch "Page with redirect" (old URLs, expected) and "Crawled/Discovered, currently not indexed" (new URLs, a problem if it lasts).
- URL Inspection on each new URL: "Google-selected canonical" must equal the user-declared canonical.

## Search Analytics API body (baseline export for all Batch 1 URLs, old + new)
POST `https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Asaharacleaningservices.com/searchAnalytics/query`
```json
{
  "startDate": "2026-08-06",
  "endDate": "2026-11-03",
  "dimensions": ["page", "query"],
  "type": "web",
  "dimensionFilterGroups": [{
    "groupType": "and",
    "filters": [
      { "dimension": "page", "operator": "includingRegex",
        "expression": ".*/(pune/(mohammadwadi|undri|nibm|kondhwa|hadapsar|magarpatta|kharadi)|cleaning-services-(mohammadwadi-411060|undri-411060|nibm-road-411048|kondhwa-411048|hadapsar-411028|magarpatta-411028|kharadi-411014))$" },
      { "dimension": "country", "operator": "equals", "expression": "ind" }
    ]
  }],
  "rowLimit": 25000
}
```
Run the same body with a later `startDate`/`endDate` at T+7, T+14 and T+28, and compare clicks and impressions of old plus new per locality against the baseline daily average.

## Checkpoints (see AUDIT_AND_BATCH1.md section C4 for pass/act thresholds)
T+1 redirects/200s, T+3 indexing, T+7 impressions ≥80% of baseline, T+14 positions within ±3, T+28 clicks and impressions ≥90%.

## Post-deploy redirect verification (curl)
Run the script (it checks every Batch 1 row; exit code 0 means all pass):
```bash
bash docs/local-seo-paste-ready/verify_redirects_batch1.sh
```
Single-URL manual checks (replace the slug and new URL):
```bash
# Expect: 308 (Next.js permanent) or 301, with Location = the new URL
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://saharacleaningservices.com/pune/mohammadwadi

# Expect: "1 200 https://saharacleaningservices.com/cleaning-services-mohammadwadi-411060" (one hop, ends at 200)
curl -sIL -o /dev/null -w "%{num_redirects} %{http_code} %{url_effective}\n" https://saharacleaningservices.com/pune/mohammadwadi

# Variants (http, www) should still land on the new URL; Next.js trailing slash adds a hop (acceptable, fix internal links)
curl -sIL -o /dev/null -w "%{num_redirects} %{url_effective}\n" http://www.saharacleaningservices.com/pune/mohammadwadi/

# Canonical and robots on the new page
curl -s https://saharacleaningservices.com/cleaning-services-mohammadwadi-411060 | grep -oiE '<link rel="canonical"[^>]*>|<meta name="robots"[^>]*>'

# Sitemap: new URL present, old URL absent
curl -s https://saharacleaningservices.com/sitemap.xml | grep -c "cleaning-services-mohammadwadi-411060"
curl -s https://saharacleaningservices.com/sitemap.xml | grep -c "/pune/mohammadwadi<"
```
Batch 2: `BATCH=2 bash docs/local-seo-paste-ready/verify_redirects_batch1.sh`.
