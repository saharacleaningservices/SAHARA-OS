// Pest-control, interior-painting and facility-management WhatsApp campaign templates (Meta-approved 2026-10-18). Run: npm run test:serviceoffers
// Fresh throwaway SQLite DB, all credentials cleared: nothing can reach the network or a customer.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import { CLOUD_TEMPLATES, dynamicUrlButtons, placeholderCount, renderTemplatePreview, templateByName } from "../src/lib/whatsapp-cloud-templates";
import { SERVICE_OFFERS, isServiceOffer, offerButtonParam, serviceOfferRecipient } from "../src/lib/whatsapp-service-offers";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-wa-offers-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.WHATSAPP_OUTBOUND_MODE = "test";
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_APP_SECRET"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let wa: typeof import("../src/lib/whatsapp");
let bc: typeof import("../src/server/whatsapp-broadcast");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  wa = await import("../src/lib/whatsapp");
  bc = await import("../src/server/whatsapp-broadcast");
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const NAMES = ["sahara_pest_control_offer", "sahara_painting_offer", "sahara_facility_management_offer"] as const;

test("definitions match what Meta approved: MARKETING, image header, one {{1}}, footer, dynamic URL button + Stop promotions", () => {
  for (const name of NAMES) {
    const t = templateByName(name)!;
    assert.ok(t, name);
    assert.equal(t.category, "MARKETING", `${name}: marketing → consent guard applies`);
    assert.equal(t.language, "en");
    assert.equal(placeholderCount(t), 1);
    assert.equal(t.examples.length, 1);
    assert.ok(t.body.length <= 1024 && t.body.startsWith("Hi {{1}}, "));
    assert.equal(t.footer, "Sahara Cleaning Services · Serving Pune since 2012");
    assert.ok((t.footer ?? "").length <= 60);
    // Header sample is a real committed file (it is also what is sent as the image link).
    const file = t.header!.sample.split("/marketing/")[1];
    assert.ok(existsSync(`public/marketing/${file}`), `${file} is shipped`);
    // Buttons: one dynamic URL (suffix {{1}}) + the Stop promotions quick reply; Meta limits respected.
    assert.equal(t.buttons!.filter((b) => b.type === "URL").length, 1);
    assert.deepEqual(t.buttons!.at(-1), { type: "QUICK_REPLY", text: "Stop promotions" });
    for (const b of t.buttons!) assert.ok(b.text.length <= 25, b.text);
    assert.equal(dynamicUrlButtons(t).length, 1);
    assert.equal(dynamicUrlButtons(t)[0].index, 0, "the URL button is index 0, where the broadcast puts its suffix");
  }
  assert.deepEqual(NAMES.map((n) => templateByName(n)!.buttons![0].text), ["Book Pest Control", "Book Free Inspection", "Request a Proposal"]);
  assert.match(templateByName("sahara_painting_offer")!.body, /furniture covered/, "owner-confirmed wording kept");
  assert.equal(new Set(CLOUD_TEMPLATES.map((t) => t.name)).size, CLOUD_TEMPLATES.length, "no duplicate template names");
  assert.equal(new Set(CLOUD_TEMPLATES.map((t) => t.key)).size, CLOUD_TEMPLATES.length, "no duplicate keys");
});

test("recipients: first name as {{1}} ('there' when unknown), banner header, booking page tagged utm_source=whatsapp&utm_medium=broadcast", () => {
  assert.ok(isServiceOffer("sahara_painting_offer") && !isServiceOffer("sahara_festival_offer"));
  const pest = serviceOfferRecipient("sahara_pest_control_offer", { mobile: "9820000101", name: "Asha Kulkarni" }, "sahara_broadcast_pest_control_2026");
  assert.deepEqual(pest.params, ["Asha"]);
  assert.equal(pest.buttonParam, "pest-control-pune?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=sahara_broadcast_pest_control_2026");
  assert.match(pest.headerImageUrl, /\/marketing\/pest-control-offer-banner\.jpg$/);
  const paint = serviceOfferRecipient("sahara_painting_offer", { mobile: "9820000102", name: "" }, "c_1");
  assert.deepEqual(paint.params, ["there"]);
  const fm = serviceOfferRecipient("sahara_facility_management_offer", { mobile: "9820000103", name: "Rao Society" }, "c_2");
  assert.equal(fm.buttonParam, "housekeeping-services?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=c_2");
  assert.match(fm.headerImageUrl, /\/marketing\/facility-management-offer-banner\.jpg$/);
  assert.equal(paint.buttonParam, offerButtonParam("interior-painting-pune", "c_1"));
  assert.match(paint.headerImageUrl, /\/marketing\/painting-offer-banner\.jpg$/);
  assert.match(renderTemplatePreview(templateByName("sahara_pest_control_offer")!, pest.params), /^Hi Asha, is your home ready/);
  for (const o of Object.values(SERVICE_OFFERS)) assert.match(o.defaultCampaign, /^[a-z0-9_]{3,60}$/, "suggested tracking name passes the campaign-name rule");
});

test("broadcast action + panel offer both templates; LIVE stays admin-only and behind WHATSAPP_CAMPAIGNS", () => {
  const act = readFileSync("src/server/actions/whatsapp-campaigns.ts", "utf8");
  for (const n of NAMES) assert.ok(act.includes(`"${n}"`), `${n} accepted by the broadcast action`);
  assert.ok(act.includes("isServiceOffer(template)") && act.includes("serviceOfferRecipient(template, r, campaign)"));
  assert.ok(act.includes('process.env.WHATSAPP_CAMPAIGNS !== "on"') && act.includes("requireAdmin"), "live sends still gated");
  assert.ok(act.includes("WHATSAPP_TEST_NUMBERS.map"), "TEST mode still sends only to the approved QA number");
  const panel = readFileSync("src/components/marketing/whatsapp-broadcast-panel.tsx", "utf8");
  for (const n of NAMES) assert.ok(panel.includes(`value: "${n}"`), `${n} in the template dropdown`);
  assert.ok(panel.includes("Send test (QA number only)") && panel.includes("No opt-in"), "1-click test send + opt-in counts remain");
});

test("TEST mode: a broadcast of either template reaches nobody except the approved QA number (here: blocked / not connected, no network)", async () => {
  for (const [i, name] of NAMES.entries()) {
    const campaign = `unit_offer_${i}`;
    const mk = (mobile: string) => ({ ...serviceOfferRecipient(name, { mobile, name: "Test Person" }, campaign) });
    const started = bc.startBroadcastJob({ campaign, templateName: name, perMinute: 100, recipients: [mk("9820000201"), mk("9820000202")], startedBy: "unit-test" });
    assert.equal(started, true);
    for (let n = 0; n < 100 && bc.getBroadcastJob()?.status === "RUNNING"; n++) await new Promise((r) => setTimeout(r, 100));
    const job = bc.getBroadcastJob()!;
    assert.equal(job.status, "DONE");
    assert.equal(job.sent, 0, "nothing was sent");
    const rows = await db.whatsAppMessage.findMany({ where: { relatedType: "Campaign", relatedId: campaign } });
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.status === "CANCELLED" && /TEST MODE/.test(r.errorMessage ?? "")));
    assert.ok(rows.every((r) => r.templateName === name));
  }
});

// LIVE mode + no credentials: a number that passes every gate stops at "not connected" — no network.
async function sendLive(template: string, mobile: string) {
  const prev = process.env.WHATSAPP_OUTBOUND_MODE;
  process.env.WHATSAPP_OUTBOUND_MODE = "live";
  try {
    return await wa.sendWhatsAppTemplate({ kind: "OTHER", toNumber: mobile, templateName: template, languageCode: "en", bodyParams: ["Asha"], preview: "p", headerImageUrl: "https://example.test/x.jpg" });
  } finally {
    process.env.WHATSAPP_OUTBOUND_MODE = prev;
  }
}
const lead = (mobile: string, consent: "OPTED_IN" | "OPTED_OUT" | "UNKNOWN") =>
  db.lead.create({ data: { leadNumber: `LD-T-${mobile}`, name: "Priya", mobile, whatsapp: mobile, area: "x", service: "HOME_DEEP_CLEANING" as never, source: "WEBSITE" as never, marketingConsent: consent as never } });

test("consent guard: both templates are refused without a recorded opt-in, pass with one, and the QA number is exempt", async () => {
  await lead("9820000301", "UNKNOWN");
  await lead("9820000302", "OPTED_OUT");
  await lead("9820000303", "OPTED_IN");
  for (const name of NAMES) {
    for (const m of ["9820000301", "9820000302", "9820000399"]) {
      const r = await sendLive(name, m);
      assert.equal(r.sent, false, `${name} → ${m}`);
      assert.match(r.error ?? "", /opt/i, `${name} → ${m}`);
    }
    assert.match((await sendLive(name, "9820000303")).error ?? "", /not connected/i, `${name}: consent accepted, only credentials missing`);
    assert.match((await sendLive(name, "9800817070")).error ?? "", /not connected/i, `${name}: QA number exempt`);
  }
  const refused = await db.whatsAppMessage.count({ where: { templateName: { in: [...NAMES] }, status: "CANCELLED", errorMessage: { contains: "opt-in" } } });
  assert.ok(refused >= 9, "every refusal is written to the log");
});

// ── "Stop promotions" quick-reply (the customer taps it under either template) ──
const APP_SECRET = "unit-test-app-secret-not-real";
async function tap(from: string, text: string, id: string) {
  const { POST } = await import("../src/app/api/webhooks/whatsapp/route");
  const { NextRequest } = await import("next/server");
  const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from, id, type: "button", timestamp: String(Math.floor(Date.now() / 1000)), button: { text, payload: text } }] } }] }] });
  const headers = { "content-type": "application/json", "x-hub-signature-256": "sha256=" + createHmac("sha256", APP_SECRET).update(raw).digest("hex") };
  return POST(new NextRequest("http://localhost/api/webhooks/whatsapp", { method: "POST", headers, body: raw }));
}

test("'Stop promotions' under either template opts the customer out of marketing; a later broadcast to them is excluded", async () => {
  process.env.WHATSAPP_APP_SECRET = APP_SECRET;
  try {
    for (const [i, m] of ["9820000401", "9820000402", "9820000403"].entries()) {
      await db.lead.create({ data: { leadNumber: `LD-T-STOP${i}`, name: "Opt Tester", mobile: m, whatsapp: m, area: "x", service: "HOME_DEEP_CLEANING" as never, source: "WEBSITE" as never, marketingConsent: "OPTED_IN" as never, marketingConsentAt: new Date() } });
      assert.equal((await tap(`91${m}`, "Stop promotions", `wamid.offer${i}`)).status, 200);
      assert.equal((await db.lead.findUnique({ where: { leadNumber: `LD-T-STOP${i}` } }))!.marketingConsent, "OPTED_OUT");
      assert.match((await sendLive(NAMES[i], m)).error ?? "", /opt/i, "no further promotion can reach them");
    }
  } finally {
    delete process.env.WHATSAPP_APP_SECRET;
  }
});
