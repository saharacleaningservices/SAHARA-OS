// Click-to-WhatsApp ad lead capture — referral parsing + the real webhook route on a throwaway database.
// Run: npm run test:ctwa   (no network; auto-replies stay off, nothing is sent)
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { ctwaLeadFields, describeCtwa, parseCtwaReferral } from "../src/lib/whatsapp-referral";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-ctwa-"));
const dbFile = path.join(dir, "t.db");
process.env.DATABASE_URL = `file:${dbFile}`;
delete process.env.WHATSAPP_APP_SECRET; // dev / test: signature check is skipped (production always requires it)
delete process.env.WHATSAPP_AUTO_REPLIES;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let POST: (req: NextRequest) => Promise<Response>;
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  POST = (await import("../src/app/api/webhooks/whatsapp/route")).POST;
  await db.user.create({ data: { name: "Altaf", email: "a@t", role: "ADMIN", passwordHash: "x" } });
  await db.user.create({ data: { name: "Shoyab Kazi", email: "shoyab@t", role: "ACCOUNTS", passwordHash: "x" } });
  await db.user.create({ data: { name: "Francis", email: "francis@t", role: "OPERATIONS", passwordHash: "x" } });
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const AD = { source_type: "ad", source_id: "120210000000001", source_url: "https://fb.me/abc", headline: "Diwali Deep Cleaning ₹3,999", body: "Book now", ctwa_clid: "Aff-clid_123" };
let n = 0;
async function inbound(from: string, text: string, referral?: unknown, name = "Asha") {
  const payload = { entry: [{ changes: [{ value: { contacts: [{ wa_id: from, profile: { name } }], messages: [{ id: `wamid.T${++n}`, from, type: "text", text: { body: text }, ...(referral ? { referral } : {}) }] } }] }] };
  const res = await POST(new NextRequest("http://localhost/api/webhooks/whatsapp", { method: "POST", body: JSON.stringify(payload), headers: { "content-type": "application/json" } }));
  assert.equal(res.status, 200);
}

test("referral parsing: valid ad is kept; junk, control characters and oversize text are cleaned or rejected", () => {
  const r = parseCtwaReferral(AD)!;
  assert.equal(r.sourceType, "ad");
  assert.equal(r.sourceId, "120210000000001");
  assert.equal(r.sourceUrl, "https://fb.me/abc");
  assert.equal(r.headline, "Diwali Deep Cleaning ₹3,999");
  assert.equal(parseCtwaReferral(null), null);
  assert.equal(parseCtwaReferral("ad"), null);
  assert.equal(parseCtwaReferral({ source_type: "ad" }), null, "must identify the ad");
  assert.equal(parseCtwaReferral({ source_type: "weird", source_id: "1" }), null);
  const dirty = parseCtwaReferral({ source_type: "ad", source_id: "1", headline: "Hi\u0000\n\u0007 there" + "x".repeat(500), source_url: "http://insecure.example" })!;
  assert.ok(!/[\u0000-\u001f]/.test(dirty.headline!) && dirty.headline!.length <= 120);
  assert.equal(dirty.sourceUrl, null, "only https links are kept");
});

test("attribution fields: tagged as the existing 'Meta Ads' channel with click_to_whatsapp medium and the ad id", () => {
  const f = ctwaLeadFields(parseCtwaReferral(AD)!, new Date("2026-10-18T00:00:00Z"));
  assert.equal(f.acquisitionChannel, "Meta Ads");
  assert.equal(f.utmMedium, "click_to_whatsapp");
  assert.equal(f.utmSource, "facebook");
  assert.equal(f.utmCampaign, "diwali_deep_cleaning_3_999");
  assert.equal(f.utmContent, "120210000000001");
  assert.equal(ctwaLeadFields(parseCtwaReferral({ ...AD, source_url: "https://instagram.com/p/xyz" })!).utmSource, "instagram");
  assert.equal(ctwaLeadFields(parseCtwaReferral({ source_type: "ad", source_id: "77" })!).utmCampaign, "ad_77");
  assert.match(describeCtwa(parseCtwaReferral(AD)!), /Click-to-WhatsApp ad on Facebook — "Diwali Deep Cleaning ₹3,999" \(id 120210000000001\)/);
});

test("webhook: a first message from a Click-to-WhatsApp ad creates ONE lead tagged Meta Ads, with timeline note and team alert", async () => {
  await inbound("919000000321", "Hi, I want the Diwali offer", AD);
  const leads = await db.lead.findMany({ where: { mobile: "9000000321" } });
  assert.equal(leads.length, 1);
  const l = leads[0];
  assert.equal(l.source, "WHATSAPP");
  assert.equal(l.acquisitionChannel, "Meta Ads");
  assert.equal(l.utmMedium, "click_to_whatsapp");
  assert.equal(l.utmContent, "120210000000001");
  assert.equal(l.firstTouchSource, "Meta Ads");
  assert.match(l.notes ?? "", /Click-to-WhatsApp ad on Facebook/);
  assert.match(l.notes ?? "", /ctwa_clid Aff-clid_123/);
  const tl = await db.timelineEntry.findMany({ where: { leadId: l.id } });
  assert.ok(tl.some((t) => /Click-to-WhatsApp ad/.test(t.body)));
  const alert = await db.notification.findFirst({ where: { kind: "NEW_INQUIRY", meta: null, title: { contains: "Ad lead on WhatsApp" } } });
  assert.ok(alert, "team alert says it came from an ad");
  assert.equal(await db.followUp.count({ where: { leadId: l.id } }), 1);
});

test("a plain WhatsApp message (no ad) is still 'WhatsApp Direct'; a second ad message from the same person adds a note, never a second lead or a changed source", async () => {
  await inbound("919000000322", "Need cleaning quote");
  const plain = (await db.lead.findFirst({ where: { mobile: "9000000322" } }))!;
  assert.equal(plain.acquisitionChannel, "WhatsApp Direct");

  const before = (await db.lead.findFirst({ where: { mobile: "9000000321" } }))!;
  await inbound("919000000321", "Also tell me about sofa cleaning", { ...AD, source_id: "999" });
  assert.equal(await db.lead.count({ where: { mobile: "9000000321" } }), 1);
  const after = (await db.lead.findUnique({ where: { id: before.id } }))!;
  assert.equal(after.acquisitionChannel, "Meta Ads");
  assert.equal(after.utmContent, "120210000000001", "original ad stays the attribution (first touch is never overwritten)");
  const notes = await db.timelineEntry.findMany({ where: { leadId: before.id } });
  assert.ok(notes.some((t) => /id 999/.test(t.body)), "the later ad is recorded as a note");
});

test("a malformed referral never blocks the lead: it is created as an ordinary WhatsApp inquiry", async () => {
  await inbound("919000000323", "hello", { source_type: "ad" });
  const l = (await db.lead.findFirst({ where: { mobile: "9000000323" } }))!;
  assert.equal(l.acquisitionChannel, "WhatsApp Direct");
});

test("Marketing dashboard stats group ad leads by campaign / ad id; plain WhatsApp leads are not counted", async () => {
  const { getCtwaLeadStats } = await import("../src/server/ctwa-stats");
  const s = await getCtwaLeadStats(90);
  assert.equal(s.total, 1, "only the one real ad lead (the plain and the malformed-referral leads are WhatsApp Direct)");
  assert.equal(s.rows.length, 1);
  assert.equal(s.rows[0].campaign, "diwali_deep_cleaning_3_999");
  assert.equal(s.rows[0].adId, "120210000000001");
  assert.equal(s.booked, 0);
  const lead = (await db.lead.findFirst({ where: { mobile: "9000000321" } }))!;
  await db.job.create({ data: { jobNumber: "T-J1", leadId: lead.id, customerName: "Asha", customerMobile: "9000000321", address: "x", area: "x", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 3999 } as never });
  assert.equal((await getCtwaLeadStats(90)).booked, 1, "a booked ad lead is counted");
});

test("page wiring: the card is on the Marketing dashboard and lists what still needs the owner", async () => {
  const fs = await import("node:fs");
  assert.ok(fs.readFileSync("src/app/(app)/profit/marketing/page.tsx", "utf8").includes("<CtwaLeadsCard"));
  const card = fs.readFileSync("src/components/marketing/ctwa-leads-card.tsx", "utf8");
  assert.ok(card.includes("PENDING USER ACTION") && card.includes("billing / payment method") && card.includes("WHATSAPP_CAMPAIGNS=on"));
});

test("an ad lead alerts Altaf, Shoyab (Accounts) and Francis (Operations) at once, with the ad named — and Francis never gets the customer's number", async () => {
  await inbound("919000000331", "Interested in the offer", { ...AD, source_id: "777", headline: "Pest Control Pune" }, "Meera");
  const mine = await db.notification.findMany({ where: { kind: "NEW_INQUIRY", title: { contains: "Ad lead on WhatsApp" }, body: { contains: "Pest Control Pune" } }, include: { user: { select: { name: true, role: true } } } });
  assert.deepEqual(mine.map((n) => n.user.role).sort(), ["ACCOUNTS", "ADMIN", "OPERATIONS"]);
  for (const n of mine) {
    assert.match(n.body ?? "", /from a Meta ad: Pest Control Pune/);
    if (n.user.role === "OPERATIONS") assert.doesNotMatch(`${n.title} ${n.body} ${n.href}`, /9000000331/, "no customer number for Operations");
  }
});

test("an ad lead is copied to the Google Sheet (when configured); plain WhatsApp inquiries and unset config are not", async () => {
  const realFetch = globalThis.fetch;
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: unknown, init?: { body?: string }) => {
    const url = String(input);
    if (url.startsWith("https://script.google.com/")) calls.push({ url, body: JSON.parse(init?.body ?? "{}") });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    // not configured → nothing posted
    await inbound("919811110001", "Hi, quote please", AD, "Sheet Off");
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(calls.length, 0, "no env → no copy");

    process.env.LEADS_SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/test/exec";
    process.env.LEADS_SHEET_WEBHOOK_SECRET = "s3cret";
    await inbound("919811110002", "Hi, pest control quote", { ...AD, source_id: "120210000000002", headline: "Pest Control in Pune" }, "Sheet On");
    await inbound("919811110003", "Hello, plain inquiry (no ad)", undefined, "No Ad");
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(calls.length, 1, "only the ad lead is copied");
    const b = calls[0].body;
    assert.equal(b.secret, "s3cret");
    assert.equal(b.phone, "9811110002");
    assert.equal(b.name, "Sheet On");
    assert.equal(b.page_source, "click_to_whatsapp");
    assert.equal(b.service, "Pest Control in Pune");
    assert.equal(b.utm_campaign, "pest_control_in_pune");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.LEADS_SHEET_WEBHOOK_URL;
    delete process.env.LEADS_SHEET_WEBHOOK_SECRET;
  }
});
