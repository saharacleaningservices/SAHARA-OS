# Cloudflare for saharacleaningservices.com — setup runbook (2026-10-26)

Cloudflare login, nameserver change and API tokens must be done by the account owner — Claude cannot log in for you.
Everything below is ordered so **email and the website never go down**. Do not skip the "copy every record first" step.

## 0. Collect before you start
| Need | Where |
|---|---|
| Hostinger VPS public IPv4 | hPanel → VPS → Overview |
| Today's DNS records | registrar / Hostinger DNS zone → export or screenshot **every** record (A, CNAME, **MX, TXT = SPF / DKIM / DMARC / google-site-verification**) |
| Where mail lives now | Google Workspace **or** Hostinger Email — the MX records tell you |
| Which host currently serves WordPress | the main site stays where it is; only its A record is re-pointed if it moves |

## 1. Add the site to Cloudflare (nothing changes yet)
1. dash.cloudflare.com → **Add a domain** → `saharacleaningservices.com` → Free plan. Cloudflare scans and imports records.
2. **Compare the imported list with your export, line by line.** Add anything missing, especially every `MX` and `TXT`.
3. Set every `MX` and mail-related record (`mail`, `smtp`, `imap`, `autodiscover`, DKIM `CNAME`s) to **DNS only (grey cloud)**. Mail must never be proxied.
4. A day before the switch, lower the TTL of the records at the old DNS host to 300 s.

## 2. A records (use the script — it is dry-run by default)
```
export CF_API_TOKEN=...   # token with only Zone→DNS→Edit and Zone→Zone Settings→Edit; keep it out of chat and out of git
export CF_ZONE_ID=...     # Cloudflare → the domain → Overview → right column
export VPS_IP=...
node scripts/cloudflare-dns.mjs            # prints the plan, changes nothing
node scripts/cloudflare-dns.mjs --apply    # creates / updates the four A records
```
| Name | Points to | Proxy |
|---|---|---|
| `saharacleaningservices.com` (main) | VPS IP — **only if the website really is served from the VPS**; if WordPress is elsewhere, leave it as it is | on |
| `crm` | VPS IP | on |
| `booking` | VPS IP | on |
| `telephony` | VPS IP | **off (DNS only)** — SIP / RTP voice cannot pass Cloudflare's HTTP proxy |

The script never deletes, never touches MX / TXT / CNAME, and skips a name that already has a CNAME.

## 3. Switch the nameservers (the only moment DNS changes hands)
At the registrar, replace the nameservers with the two Cloudflare gives you. Cloudflare serves the copied records immediately, so mail keeps flowing.
Check within the hour: send a test mail **to** and **from** `contact@saharacleaningservices.com`, open crm. / booking. in a private window.

## 4. SSL, HTTPS, caching, protection
* **SSL/TLS → Overview:** start on **Full** (`--ssl=full`). Move to **Full (strict)** (`--ssl=strict`) once Coolify's origin certificate is confirmed valid
  (if Let's Encrypt renewals fail behind the proxy, use a free Cloudflare **Origin CA** certificate in Coolify instead).
* **Edge Certificates:** Always Use HTTPS on (`--always-https`), minimum TLS 1.2, HSTS only after strict mode works.
* **Caching → Cache Rules** (order matters):
  1. `crm.saharacleaningservices.com/*` → **Bypass cache** (logged-in CRM, never cache).
  2. `*/api/*`, `*/uploads/*` → **Bypass cache** (private call recordings and customer files — the app already sends `private, no-store`).
  3. `booking.…/_next/static/*` and `*/marketing/*`, `*/brand/*` → **Eligible for cache**, Edge TTL 1 month (immutable assets).
* **Security → Bots / DDoS:** DDoS protection is automatic. **Bot Fight Mode can block non-browser callers** (Meta WhatsApp webhooks, Google Apps Script,
  the Sahara OS Helper app, your IVR). Turn it **off for `crm.`**, or keep it on and add a WAF *Skip* rule for these paths and test every one:
  `/api/webhooks/*`, `/api/webhook/*`, `/api/v1/webhooks/*`, `/api/booking-link*`. Add a rate-limiting rule on `/api/v1/webhooks/*` (e.g. 60 requests / minute / IP).

## 5. Email migration (Google Workspace ⇄ Hostinger Email) — separate, later
Cloudflare does not host mail; it only publishes the MX records. Do the mailbox move **before** touching MX:
1. Create the mailboxes at the new provider and copy mail (IMAP migration tool).
2. Lower the MX TTL to 300 s, then replace the MX + SPF TXT + DKIM records with the new provider's values (keep grey cloud).
3. Keep the old mailboxes alive for 48 hours — mail already in flight still lands there; then forward / import the stragglers.
Tell Claude which direction you are migrating and it will prepare the exact record values.

## Roll-back
Cloudflare → DNS → each record has history; to leave Cloudflare entirely, set the registrar nameservers back to the old ones (your exported records are the source of truth).
