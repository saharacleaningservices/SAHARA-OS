# VPS capacity and resource audit (2026-10-16)

Sources: Hostinger hPanel usage charts and Coolify server pages read on 2026-10-15 (`docs/CRM_LEAD_CAPTURE_PLAN.md`
§11.3), live response-time checks from outside on 2026-10-16, backup sizes from the backup workflow. **No shell / SSH
access** from this machine (no key configured) — per-container numbers need the owner to open Coolify → Server →
Metrics or a terminal. Nothing was changed on the server.

## 1. Server
| Item | Value |
|---|---|
| Plan | Hostinger **KVM 2** — 2 vCPU, 8 GB RAM, 100 GB disk, Ubuntu; prepaid to **2028-09-05** |
| IP / apps | `187.53.134.175`; Coolify, 1 server, **1 application** (Sahara OS) serving `crm.` `booking.` `app.` |
| Proxy | Traefik (Coolify). Coolify showed "Restart proxy required" on 15 Oct — restarting briefly takes all three sites offline; do it in a quiet window |
| Firewall | Hostinger firewall has 0 rules; Coolify admin ports 8000/6001/6002 open (owner decision pending) |

## 1b. Live check — Hostinger hPanel, 16 Oct (read-only)
| Item | Value |
|---|---|
| Status / uptime | Running, 41 days 6 h |
| CPU / Memory / Disk | **8 %** / **27 %** (~2.2 GB of 8) / **6 GB of 100 GB** |
| Bandwidth | 0.029 TB of 8 TB |
| OS / location | Ubuntu 26.04 LTS · **Malaysia – Kuala Lumpur** (not India — consider an India data centre at renewal or before a second platform; today's 0.3 s response time is acceptable) |
| Backups | Weekly, 2 snapshots; malware scanner active; daily backups not purchased (₹589/mo) |
| Firewall rules | **0** — Coolify ports 8000/6001/6002 reachable from the internet (owner decision) |
| Plan | KVM 2, expires 2028-09-05, auto-renewal on |
Coolify container health could not be read (the session safety guard blocked opening the Coolify dashboard).

## 2. Usage (15 Oct, server-wide)
| Metric | Normal | Peak | Headroom |
|---|---|---|---|
| CPU | ~8 % | ~34 % during a build (a few minutes) | Large at rest; **builds are the constraint on 2 vCPU** |
| RAM | 2.0–2.3 GB | ~2.5 GB during a build (1-min sampling) | **~5.5 GB free** |
| Disk | 6–11 GB | 23.5 GB right after a build (images + build cache) | **~75 GB free**; Coolify Docker cleanup daily 00:00 UTC (05:30 IST) |

Live response time (16 Oct, from outside, server time to first byte): booking pages **0.26–0.42 s**, CRM login
**0.24–0.34 s** — healthy. (The WordPress site on cPanel: 1.7–5.8 s.)

## 3. Data and backups
- Database: SQLite file; nightly backup archive ≈ **5.3 MB** (14 Oct: 63 tables, ~4,230 customers, ~220 leads, ~245 jobs).
- Off-site: Google Drive, 30 daily + 12 monthly kept → < 250 MB total. Encrypted second copy (PR #4) is a 30-day GitHub
  artifact. Hostinger weekly VPS backup exists (same provider; restore never tested).
- Disk growth from data is negligible; growth comes from Docker images/build cache (cleaned nightly) and uploads.

## 4. Capacity for a second platform (Urban Company / NoBroker-style customer site)
**Verdict: the current VPS can host it at launch scale, with three conditions.**
| Need | Estimate | Fits? |
|---|---|---|
| Second Next.js app (runtime) | 300–600 MB RAM | ✅ (~5.5 GB free) |
| Its own database | **Use PostgreSQL** (a marketplace with many concurrent writers outgrows SQLite) — Coolify one-click Postgres, ~200–400 MB RAM | ✅ |
| Builds of two apps | +1–2 GB RAM and both vCPUs for minutes per build | ⚠️ only if builds don't run at the same time |
| Disk | +10–20 GB (images, DB, uploads) | ✅ (~75 GB free) |

Conditions:
1. **Never build both apps at once** on 2 vCPU (Coolify: deploy one at a time), or build images in GitHub Actions and
   let Coolify only pull them.
2. **Separate database and volume** for the new site; never share the CRM's SQLite file.
3. **Upgrade trigger:** sustained CPU > 60 % or RAM > 6 GB for a week, or > ~1,000 bookings/day → move to KVM 4
   (4 vCPU / 16 GB) — owner budget decision. Re-check after the first month.

Before adding anything: run a tested restore of the CRM (done locally — RESTORABLE), confirm the Hostinger weekly backup,
and decide the open-ports firewall question.

## 5. Owner actions (read-only checks Claude cannot do without access)
- Coolify → Server → Metrics: screenshot CPU/RAM/disk for the last 7 days (per-container if shown).
- Coolify → Server → Proxy: plan the pending proxy restart for a quiet hour.
- Hostinger → VPS → Firewall: decide whether to restrict ports 8000/6001/6002 to your IP.
