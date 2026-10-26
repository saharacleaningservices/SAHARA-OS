// scripts/cloudflare-dns.mjs against a local mock of the Cloudflare API (no network). Run: npm run test:cloudflare
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AddressInfo } from "node:net";

const run = promisify(execFile);
type Rec = { id: string; type: string; name: string; content: string; proxied?: boolean };
const Z = "saharacleaningservices.com";

function mock(records: Rec[]) {
  const writes: string[] = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, "http://x");
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.method === "GET" && url.pathname.endsWith("/dns_records")) {
        const name = url.searchParams.get("name");
        return res.end(JSON.stringify({ success: true, result: records.filter((r) => r.name === name) }));
      }
      writes.push(`${req.method} ${url.pathname} ${body}`);
      res.end(JSON.stringify({ success: true, result: {} }));
    });
  });
  return new Promise<{ base: string; writes: string[]; close: () => void }>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, writes, close: () => server.close() })),
  );
}
const exec = (base: string, ...args: string[]) =>
  run("node", ["scripts/cloudflare-dns.mjs", ...args], { env: { ...process.env, CF_API_BASE: base, CF_API_TOKEN: "t".repeat(20), CF_ZONE_ID: "zone1", VPS_IP: "203.0.113.10" } });

const records: Rec[] = [
  { id: "r1", type: "A", name: Z, content: "198.51.100.7", proxied: false }, // old IP → update
  { id: "r2", type: "A", name: `crm.${Z}`, content: "203.0.113.10", proxied: true }, // already right → ok
  { id: "r3", type: "CNAME", name: `booking.${Z}`, content: "other.example.com" }, // conflict → skipped
  { id: "r4", type: "MX", name: Z, content: "mail.example.com" }, // must never be touched
  // telephony: missing → create (DNS only)
];

test("dry run prints the plan and writes NOTHING", async () => {
  const m = await mock(records);
  try {
    const { stdout } = await exec(m.base);
    assert.match(stdout, /DRY RUN/);
    assert.match(stdout, /UPDATE\s+saharacleaningservices\.com/);
    assert.match(stdout, /OK\s+crm\./);
    assert.match(stdout, /SKIP\s+booking\..*CNAME/);
    assert.match(stdout, /CREATE\s+telephony\..*DNS only/);
    assert.deepEqual(m.writes, []);
  } finally { m.close(); }
});

test("--apply creates / updates only A records, never deletes, never touches MX; telephony is DNS-only; SSL + HTTPS flags work", async () => {
  const m = await mock(records);
  try {
    await exec(m.base, "--apply", "--ssl=full", "--always-https");
    const w = m.writes;
    assert.ok(w.some((x) => x.startsWith("PUT /zones/zone1/dns_records/r1") && x.includes('"content":"203.0.113.10"') && x.includes('"proxied":true')));
    assert.ok(w.some((x) => x.startsWith("POST /zones/zone1/dns_records") && x.includes(`"name":"telephony.${Z}"`) && x.includes('"proxied":false')));
    assert.ok(!w.some((x) => x.includes("/dns_records/r2")), "correct record untouched");
    assert.ok(!w.some((x) => x.includes("/dns_records/r3")), "CNAME conflict untouched");
    assert.ok(!w.some((x) => x.includes("/dns_records/r4") || x.includes('"type":"MX"')), "MX untouched");
    assert.ok(!w.some((x) => x.startsWith("DELETE")), "never deletes");
    assert.ok(w.some((x) => x.startsWith("PATCH /zones/zone1/settings/ssl") && x.includes('"full"')));
    assert.ok(w.some((x) => x.startsWith("PATCH /zones/zone1/settings/always_use_https")));
  } finally { m.close(); }
});

test("refuses to run without credentials or with a bad IP", async () => {
  await assert.rejects(run("node", ["scripts/cloudflare-dns.mjs"], { env: { PATH: process.env.PATH } }), (e: { code?: number }) => e.code === 2);
  await assert.rejects(run("node", ["scripts/cloudflare-dns.mjs"], { env: { PATH: process.env.PATH, CF_API_TOKEN: "x", CF_ZONE_ID: "z", VPS_IP: "999.1.1.1" } }), (e: { code?: number }) => e.code === 2);
});
