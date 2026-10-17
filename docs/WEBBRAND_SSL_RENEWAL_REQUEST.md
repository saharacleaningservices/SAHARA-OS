# SSL renewal request to WebBrand (main website) — draft, 2026-10-17

Owner sends this; nothing on the main website, DNS or hosting is changed by Sahara OS work.

## Verified facts (17 Oct 2026, from outside)
| Host | Certificate expires | Issuer | Points to |
|---|---|---|---|
| `www.saharacleaningservices.com` | **1 Nov 2026, 11:01 UTC** | Let's Encrypt (YR2) | `192.185.129.241` (WebBrand hosting) |
| `saharacleaningservices.com` | **1 Nov 2026, 11:01 UTC** | Let's Encrypt (YR2) | same |
| `booking.` / `crm.` (Hostinger VPS, Coolify) | 22 Dec 2026 | — | not WebBrand; auto-renewed by Coolify |

Let's Encrypt certificates normally auto-renew about 30 days before expiry. On 17 Oct (15 days left) it has not
renewed, so auto-renewal (AutoSSL) is likely failing or disabled on the hosting account.

## Message to send (e-mail / WhatsApp to WebBrand)
> Subject: SSL certificate renewal — saharacleaningservices.com (expires 1 Nov 2026)
>
> Hello WebBrand team,
>
> The SSL certificate for www.saharacleaningservices.com and saharacleaningservices.com expires on
> 1 November 2026 (Let's Encrypt). It has not auto-renewed yet. Could you please:
> 1. Run / fix AutoSSL (or the Let's Encrypt renewal) for both the domain and the www sub-domain;
> 2. Confirm the new expiry date once it is done;
> 3. Let us know if anything is needed from our side (we manage the domain registration).
>
> Please do not change any DNS records — booking.saharacleaningservices.com and crm.saharacleaningservices.com
> run on our own server and must stay as they are.
>
> Thank you,
> Sahara Cleaning Services

## After they reply
Re-check: `openssl s_client -servername www.saharacleaningservices.com -connect www.saharacleaningservices.com:443`
→ `notAfter` should move to around late January 2027.
