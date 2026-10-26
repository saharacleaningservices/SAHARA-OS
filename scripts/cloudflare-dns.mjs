#!/usr/bin/env node
// Cloudflare DNS helper for saharacleaningservices.com (owner 2026-10-26). SAFE BY DEFAULT: without --apply it only prints what it would do.
//
//   CF_API_TOKEN=...  CF_ZONE_ID=...  VPS_IP=1.2.3.4  node scripts/cloudflare-dns.mjs            # dry run: plan only
//   CF_API_TOKEN=...  CF_ZONE_ID=...  VPS_IP=1.2.3.4  node scripts/cloudflare-dns.mjs --apply    # create / update the A records
//   ... --apply --ssl=full            # then, once the origin certificate is confirmed:  --apply --ssl=strict  --always-https
//
// What it touches: A records for @ (the main domain), crm, booking, telephony — nothing else. It NEVER deletes a record and NEVER touches
// MX / TXT / CNAME records (mail keeps working through the whole change). A name that already has a CNAME is reported and skipped.
// Proxy (orange cloud): on for the three web names; OFF for "telephony" (SIP / RTP audio cannot pass Cloudflare's HTTP proxy).
// The API token is read from the environment only (create it with just "Zone → DNS → Edit" and "Zone → Zone Settings → Edit").
const args = new Set(process.argv.slice(2));
const flag = (name) => [...args].find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const apply = args.has("--apply");
const base = (process.env.CF_API_BASE || "https://api.cloudflare.com/client/v4").replace(/\/$/, "");
const token = process.env.CF_API_TOKEN;
const zoneId = process.env.CF_ZONE_ID;
const ip = process.env.VPS_IP;
const ZONE = process.env.CF_ZONE_NAME || "saharacleaningservices.com";

if (!token || !zoneId || !ip) {
  console.error("Set CF_API_TOKEN, CF_ZONE_ID and VPS_IP (environment variables — never paste the token anywhere else).");
  process.exit(2);
}
if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split(".").some((n) => Number(n) > 255)) {
  console.error(`VPS_IP "${ip}" is not an IPv4 address.`);
  process.exit(2);
}

const WANTED = [
  { label: "main domain", name: ZONE, proxied: true },
  { label: "crm", name: `crm.${ZONE}`, proxied: true },
  { label: "booking", name: `booking.${ZONE}`, proxied: true },
  { label: "telephony", name: `telephony.${ZONE}`, proxied: false },
];

async function cf(method, path, body) {
  const res = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(`${method} ${path} → HTTP ${res.status} ${JSON.stringify(json.errors ?? json).slice(0, 300)}`);
  return json;
}

const plan = [];
for (const w of WANTED) {
  const found = (await cf("GET", `/zones/${zoneId}/dns_records?name=${encodeURIComponent(w.name)}&per_page=50`)).result ?? [];
  const cname = found.find((r) => r.type === "CNAME");
  const a = found.filter((r) => r.type === "A");
  if (cname) plan.push({ ...w, action: "skip", why: `has a CNAME → ${cname.content} (left alone)` });
  else if (a.length === 0) plan.push({ ...w, action: "create" });
  else if (a.length === 1 && a[0].content === ip && a[0].proxied === w.proxied) plan.push({ ...w, action: "ok" });
  else if (a.length === 1) plan.push({ ...w, action: "update", id: a[0].id, from: `${a[0].content}${a[0].proxied ? " (proxied)" : ""}` });
  else plan.push({ ...w, action: "skip", why: `${a.length} A records already (left alone — fix by hand)` });
}

console.log(`${apply ? "APPLYING" : "DRY RUN (add --apply to make changes)"} — zone ${ZONE}, origin ${ip}`);
for (const p of plan) console.log(`  ${p.action.toUpperCase().padEnd(6)} ${p.name.padEnd(40)} ${p.proxied ? "proxied" : "DNS only"}${p.from ? `  (was ${p.from})` : ""}${p.why ? `  — ${p.why}` : ""}`);

if (apply) {
  for (const p of plan) {
    const rec = { type: "A", name: p.name, content: ip, ttl: 1, proxied: p.proxied, comment: `Sahara OS ${p.label}` };
    if (p.action === "create") await cf("POST", `/zones/${zoneId}/dns_records`, rec);
    if (p.action === "update") await cf("PUT", `/zones/${zoneId}/dns_records/${p.id}`, rec);
  }
  const ssl = flag("ssl");
  if (ssl) {
    if (!["full", "strict"].includes(ssl)) throw new Error("--ssl must be full or strict");
    await cf("PATCH", `/zones/${zoneId}/settings/ssl`, { value: ssl });
    console.log(`  SSL mode → ${ssl}`);
  }
  if (args.has("--always-https")) {
    await cf("PATCH", `/zones/${zoneId}/settings/always_use_https`, { value: "on" });
    console.log("  Always Use HTTPS → on");
  }
  console.log("Done. Nothing was deleted; MX / TXT records were not touched.");
}
