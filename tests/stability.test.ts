// 2026-10-18 stability audit: concurrent ID allocation, error boundaries, repeating inquiry chime, price-list sharing.
// Run: npm run test:stability
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PRICING_MASTER } from "../src/lib/pricing-master";
import { buildShareGroups, whatsappShareUrl } from "../src/lib/price-share";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-stab-"));
const dbFile = path.join(dir, "t.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let ids: typeof import("../src/lib/id-generators");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  ids = await import("../src/lib/id-generators");
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test("100 simultaneous lead submissions all save, with unique contiguous Lead IDs (was: 1 saved, 24 of 25 failed)", async () => {
  const N = 100;
  const results = await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      try {
        const leadNumber = await ids.generateLeadNumber();
        await db.lead.create({ data: { leadNumber, name: `Race ${i}`, mobile: `90000${String(i).padStart(5, "0")}`, area: "Test", service: "HOME_DEEP_CLEANING", source: "WEBSITE" } as never });
        return leadNumber;
      } catch (e) {
        return `FAIL: ${(e as Error).message.split("\n").pop()}`;
      }
    }),
  );
  assert.deepEqual(results.filter((r) => r.startsWith("FAIL")), []);
  const nums = results.map((r) => Number(r.slice(-4))).sort((a, b) => a - b);
  assert.equal(new Set(nums).size, N, "no duplicate numbers");
  assert.deepEqual(nums, Array.from({ length: N }, (_, i) => nums[0] + i), "no missing index");
  assert.equal(await db.lead.count(), N);
});

test("every sequence is race-safe: jobs, quotations, invoices, customers — concurrent numbers are unique and contiguous", async () => {
  const check = async (label: string, gen: () => Promise<string>) => {
    const got = await Promise.all(Array.from({ length: 40 }, () => gen()));
    const n = got.map((g) => Number(g.slice(-4))).sort((a, b) => a - b);
    assert.equal(new Set(n).size, 40, `${label}: duplicates`);
    assert.deepEqual(n, Array.from({ length: 40 }, (_, i) => n[0] + i), `${label}: gap`);
  };
  await check("job", ids.generateJobNumber);
  await check("quotation", ids.generateQuoteNumber);
  await check("invoice", ids.generateInvoiceNumber);
  await check("standalone invoice", ids.generateStandaloneInvoiceNumber);
  await check("customer", ids.generateCustomerNumber);
});

test("error boundaries exist for pages, the root layout and unknown URLs", () => {
  for (const f of ["src/app/error.tsx", "src/app/global-error.tsx", "src/app/not-found.tsx"]) assert.ok(existsSync(f), f);
  const g = readFileSync("src/app/global-error.tsx", "utf8");
  assert.ok(g.includes("<html") && g.includes("<body"), "global-error brings its own html/body");
  assert.ok(!/error\.stack|error\.message\}/.test(readFileSync("src/app/error.tsx", "utf8").replace(/console\.error[^\n]*\n/, "")), "no stack trace shown to users");
});

test("new-inquiry chime repeats while unacknowledged and stops when muted", () => {
  const src = readFileSync("src/components/notifications/new-inquiry-alert.tsx", "utf8");
  assert.ok(src.includes("REPEAT_MS = 60_000") && src.includes("setInterval(() => {") && src.includes("if (!pending || muted) return;") && src.includes("clearInterval(id)"));
});

test("price-list share: one tap per service / category, painting rates never leave the building", () => {
  const groups = buildShareGroups(PRICING_MASTER, [], "https://booking.example.test/booking?utm_source=whatsapp", "2026-10-18");
  assert.ok(groups.length >= 6);
  const painting = groups.find((g) => g.key === "PAINTING")!;
  assert.ok(painting.items.length > 0);
  for (const i of painting.items) assert.ok(!/₹/.test(i.share) && /inspection/i.test(i.share), `${i.name}: ${i.share}`);
  assert.ok(!/₹/.test(painting.shareAll));
  const premium = groups.find((g) => g.key === "PREMIUM")!;
  assert.match(premium.items[0].share, /₹[\d,]+/);
  assert.ok(premium.items[0].share.includes("https://booking.example.test/booking?utm_source=whatsapp"));
  assert.ok(whatsappShareUrl("a b").startsWith("https://wa.me/?text=a%20b"), "no phone number baked in — user picks the customer");
});

test("price-list festival price appears in the share only where a public price exists", () => {
  const home = PRICING_MASTER.find((p) => p.group === "PREMIUM")!;
  const paint = PRICING_MASTER.find((p) => p.group === "PAINTING")!;
  const fest = [{ id: "f", name: "Diwali", start: "2026-10-01", end: "2026-11-30", prices: { [home.contentId]: 3999, [paint.contentId]: 1 } }];
  const groups = buildShareGroups(PRICING_MASTER, fest, "https://b.test/booking", "2026-10-18");
  const h = groups.flatMap((g) => g.items).find((i) => i.id === home.contentId)!;
  const p = groups.flatMap((g) => g.items).find((i) => i.id === paint.contentId)!;
  assert.ok(h.share.includes("Diwali offer: ₹3,999"));
  assert.ok(!p.share.includes("Diwali offer") && !/₹/.test(p.share));
});

test("staff app privacy (owner 2026-10-18): crew pages carry no job price / collection field; they have a Call Office button, schedule, address, map link and team", () => {
  const portal = readFileSync("src/server/staff-portal.ts", "utf8");
  const detail = portal.slice(portal.indexOf("export async function getMyJob"));
  assert.ok(!/jobValue|paidAmount|priceType|festivalName|payments:/.test(detail.slice(0, detail.indexOf("\nexport async function", 10) > 0 ? detail.indexOf("\nexport async function", 10) : undefined)), "job detail selects no money field");
  const day = portal.slice(portal.indexOf("export async function getMyDay"), portal.indexOf("export async function getMyDay") + 3200);
  assert.ok(!/jobValue|paidAmount|priceType|payments: \{/.test(day), "day view selects no money field");
  assert.ok(!portal.includes("staffBalanceToCollect"), "balance-to-collect is not computed for staff any more");
  for (const f of ["src/app/my/day/[date]/page.tsx", "src/app/my/jobs/[id]/page.tsx"]) {
    const src = readFileSync(f, "utf8");
    assert.ok(src.includes('t("callOfficePayment")') && src.includes("tel:${officePhone}"), `${f}: Call Office for Payment Details`);
    assert.ok(!/balanceToCollect|\.collect\b|balanceDue/.test(src), `${f}: no collection amount`);
    assert.ok(src.includes("mapLink") || src.includes("directionsHref"), `${f}: Google Maps link`);
  }
  const i18n = readFileSync("src/lib/staff-i18n.ts", "utf8");
  assert.match(i18n, /callOfficePayment: \["Call Office for Payment Details", "[^"]+", "[^"]+"\]/, "English + Hindi + Marathi");
});

test("staff 'Review / Pay QR' page: the payment QR carries NO amount; the page shows no price, balance or job total", () => {
  const src = readFileSync("src/app/my/tools/page.tsx", "utf8");
  const link = src.match(/upi:\/\/pay\?[^`]*/)?.[0] ?? "";
  assert.ok(link.includes("pa=") && link.includes("cu=INR"), "a plain UPI link to the company ID");
  assert.ok(!/[?&]am=|[?&]tn=|[?&]tr=/.test(link), "no pre-filled amount / note / reference");
  assert.ok(!/formatINR|inrFor|₹|jobValue|balance|collect|\.amount/i.test(src.replace(/<IndianRupee[^>]*\/>/g, "").replace(/\/\/.*$/gm, "")), "no money values rendered");
  assert.ok(!src.includes("getMyJob") && !src.includes("payments"), "does not load job money");
});
