# Google Workspace e-mail — DNS authentication runbook (weekend task)

Prepared 2026-10-16 from read-only public DNS lookups. **No MX cutover is needed:** mail for
`saharacleaningservices.com` already goes to Google Workspace. Claude made no DNS, MX or Admin-console change.

## Current state (verified 2026-10-16)
| Record | Value today | Verdict |
|---|---|---|
| DNS host (NS) | `dns1/dns2.registrar-servers.com` — **Namecheap** (not cPanel) | Changes are made in Namecheap → Domain List → Manage → Advanced DNS |
| MX | `aspmx.l.google.com` (1), `alt1/alt2.aspmx.l.google.com` (5), `aspmx2/aspmx3.googlemail.com` (10) | ✅ Google Workspace — **do not change** |
| SPF (TXT @) | `v=spf1 a mx include:websitewelcome.com ~all` | ❌ Google is not listed → mail sent from Gmail/Workspace soft-fails SPF (spam risk) |
| DKIM (`google._domainkey`) | none | ❌ Workspace mail is not DKIM-signed for the domain |
| DMARC (`_dmarc`) | none | ❌ No policy, no reports |
| Google site verification | 2 TXT records | ✅ keep both |

Who sends mail as @saharacleaningservices.com: **Google Workspace** (people) and the **WordPress site on cPanel**
(contact forms — that is the `websitewelcome.com` include, HostGator). Sahara OS itself sends no e-mail today
(its e-mail provider is not connected).

## Before you start
1. **Fix the Workspace payment first** (see `docs/URGENT_OWNER_ACTIONS_2026-10-16.md` §1). DKIM is generated in the
   Admin console, which must be active.
2. Do this at a quiet time (weekend). These changes do **not** move mail; worst case is mail being marked as spam
   until a typo is corrected. Keep this page open to undo.
3. Screenshot the current Advanced DNS page in Namecheap (rollback = put the old values back).

## Step 1 — SPF (one TXT record, edit the existing one; never add a second SPF record)
Namecheap → Advanced DNS → find TXT host `@` with value starting `v=spf1` → Edit → replace the value with:

```
v=spf1 include:_spf.google.com include:websitewelcome.com a mx ~all
```
Save. (Keeps everything that works today and adds Google.)

## Step 2 — DKIM (Google signs your mail)
1. admin.google.com → Apps → Google Workspace → Gmail → **Authenticate email**.
2. Domain `saharacleaningservices.com` → **Generate new record** → key length **2048** → prefix `google` → Generate.
3. Google shows a TXT **host name** (`google._domainkey`) and a long **value** (`v=DKIM1; k=rsa; p=…`).
4. Namecheap → Advanced DNS → **Add new record** → TXT Record → Host `google._domainkey` → Value = the full text from
   Google → Save. (If Namecheap rejects the length, paste it exactly as one line; it accepts long TXT values.)
5. Wait 1–48 h for DNS, then back in Gmail → Authenticate email → **Start authentication**. Status should become
   "Authenticating email with DKIM".

## Step 3 — DMARC (start in monitor mode — nothing is blocked)
Namecheap → Advanced DNS → Add new record → TXT Record → Host `_dmarc` → Value:

```
v=DMARC1; p=none; rua=mailto:contact@saharacleaningservices.com; fo=1
```
Save. After 2–4 weeks of clean reports, tighten to `p=quarantine` (later `p=reject`) — only after confirming every
legitimate sender (Workspace, website forms) passes.

## Step 4 — Verify (Claude can do this from outside, read-only)
- `nslookup -type=TXT saharacleaningservices.com` → SPF contains `include:_spf.google.com`.
- `nslookup -type=TXT google._domainkey.saharacleaningservices.com` → `v=DKIM1…`.
- `nslookup -type=TXT _dmarc.saharacleaningservices.com` → `v=DMARC1; p=none…`.
- Send a test mail from contact@ to a personal Gmail → open it → ⋮ → **Show original** → SPF **PASS**, DKIM **PASS**,
  DMARC **PASS**.

## Rollback
Put back the old SPF value (`v=spf1 a mx include:websitewelcome.com ~all`) and delete the two new TXT records.
MX records are never touched by this runbook.
