// Weekly Command Center (owner 2026-11-14): pure computation. Run: npx tsx --test tests/weekly-command-center.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWeeklyCommandCenter, crossSellOf, CROSS_SELL_IDS, istWeekRange, paymentBucket, pctChange, weekMetrics, type CcInput } from "../src/lib/weekly-command-center";
import { SETTINGS_PAGES } from "../src/components/layout/nav-config";
import { canAccess } from "../src/lib/constants";

// Saturday 14 Nov 2026, 10:00 IST
const NOW = new Date("2026-11-14T04:30:00Z");
const ist = (ymd: string, hm = "12:00") => new Date(`${ymd}T${hm}:00+05:30`);

test("IST weeks run Monday 00:00 → next Monday 00:00 IST, whatever the server timezone", () => {
  const tw = istWeekRange(NOW);
  assert.equal(tw.from.toISOString(), "2026-11-08T18:30:00.000Z", "Mon 9 Nov 00:00 IST");
  assert.equal(tw.to.toISOString(), "2026-11-15T18:30:00.000Z");
  assert.equal(tw.label, "9 Nov – 15 Nov");
  const lw = istWeekRange(NOW, 1);
  assert.equal(lw.from.toISOString(), "2026-11-01T18:30:00.000Z");
  assert.equal(lw.to.toISOString(), tw.from.toISOString());
  // Monday 00:10 IST is already the new week; Sunday 23:50 IST still the old one
  assert.equal(istWeekRange(ist("2026-11-09", "00:10")).from.toISOString(), tw.from.toISOString());
  assert.equal(istWeekRange(ist("2026-11-08", "23:50")).from.toISOString(), lw.from.toISOString());
  // Sunday maps back to the Monday before it
  assert.equal(istWeekRange(ist("2026-11-15", "20:00")).from.toISOString(), tw.from.toISOString());
});

test("cross-sell: add-on lines after the main service count; the main service and complimentary lines never do", () => {
  const items = (lines: object[]) => JSON.stringify(lines);
  const home = { contentId: "SCS-02", group: "PREMIUM", name: "2 BHK Premium", qty: 1, unitPrice: 5999 };
  const chimney = { contentId: "SCS-35", group: "CUSTOMISED", name: "Chimney", qty: 1, unitPrice: 599 };
  const sofa = { contentId: "SCS-09", group: "CUSTOMISED", name: "Sofa", qty: 5, unitPrice: 199 };
  const window = { contentId: "SCS-30", group: "CUSTOMISED", name: "Window", qty: 4, unitPrice: 299 };
  assert.equal(crossSellOf({ serviceItems: items([home, chimney, sofa, window]) }), 599 + 995, "window is not on the cross-sell list");
  assert.equal(crossSellOf({ serviceItems: items([sofa, chimney]) }), 599, "sofa-only booking: sofa is the main service");
  assert.equal(crossSellOf({ serviceItems: items([home, { ...chimney, complimentary: true }]) }), 0);
  assert.equal(crossSellOf({ serviceItems: null, lead: { serviceItems: items([home, { contentId: "SCS-32", name: "Fridge", qty: 1, unitPrice: 499 }]) } }), 499, "falls back to the lead's lines");
  assert.equal(crossSellOf({ lead: { addOnServices: JSON.stringify(["Chimney Deep Cleaning × 2", "Kitchen Pest Control (add-on) × 1", "Window Cleaning × 3", "Unknown × 1"]) } }), 599 * 2 + 1199);
  assert.equal(crossSellOf({ lead: { addOnServices: "not json" } }), 0);
  assert.equal(crossSellOf({}), 0);
  for (const id of ["SCS-35", "SCS-32", "SCS-36", "SCS-09", "SCS-11", "SCS-12", "SCS-10"]) assert.ok(CROSS_SELL_IDS.has(id), id);
});

test("payment buckets: UPI + QR → UPI, CASH → Cash, everything else → Other", () => {
  assert.equal(paymentBucket("UPI"), "UPI");
  assert.equal(paymentBucket("qr"), "UPI");
  assert.equal(paymentBucket("CASH"), "CASH");
  assert.equal(paymentBucket("BANK"), "OTHER");
  assert.equal(paymentBucket(null), "OTHER");
});

test("This Week vs Last Week: leads, bookings, completed, gross, net UPI / cash, AOV, cross-sell, sources, start-code compliance", () => {
  const twDay = "2026-11-10";
  const lwDay = "2026-11-03";
  const input: CcInput = {
    leads: [
      { createdAt: ist(twDay), source: "WEBSITE" }, { createdAt: ist(twDay), source: "WEBSITE" }, { createdAt: ist(twDay), source: "GMB" },
      { createdAt: ist(lwDay), source: "CALL" },
      { createdAt: ist("2026-10-20"), source: "CALL" }, // older — ignored
    ],
    jobsCreated: [{ createdAt: ist(twDay) }, { createdAt: ist(twDay) }, { createdAt: ist(lwDay) }],
    completed: [
      { completedAt: ist(twDay), jobValue: 6000, startOtp: "1234", startOtpVerifiedAt: ist(twDay), serviceItems: JSON.stringify([{ contentId: "SCS-02", name: "2 BHK", qty: 1, unitPrice: 5401 }, { contentId: "SCS-35", name: "Chimney", qty: 1, unitPrice: 599 }]) },
      { completedAt: ist(twDay), jobValue: 3000, startOtp: "5678", startOtpVerifiedAt: null },
      { completedAt: ist(twDay), jobValue: 1000, startOtp: null, startOtpVerifiedAt: null },
      { completedAt: ist(lwDay), jobValue: 4000, startOtp: "1111", startOtpVerifiedAt: ist(lwDay) },
      { completedAt: null, jobValue: 9999, startOtp: null, startOtpVerifiedAt: null },
    ],
    payments: [
      { paidDate: ist(twDay), paidAmount: 6000, mode: "UPI" },
      { paidDate: ist(twDay), paidAmount: 1500, mode: "CASH" },
      { paidDate: ist(twDay), paidAmount: 500, mode: "QR" },
      { paidDate: ist(twDay), paidAmount: 0, mode: "CASH" },
      { paidDate: ist(lwDay), paidAmount: 4000, mode: "BANK" },
      { paidDate: null, paidAmount: 100, mode: "UPI" },
    ],
  };
  const cc = buildWeeklyCommandCenter(input, NOW);
  const t = cc.thisWeek.m;
  assert.equal(t.leads, 3);
  assert.equal(t.confirmedBookings, 2);
  assert.equal(t.completedJobs, 3);
  assert.equal(t.grossRevenue, 10000);
  assert.equal(t.collectedUpi, 6500);
  assert.equal(t.collectedCash, 1500);
  assert.equal(t.collectedOther, 0);
  assert.equal(t.netCollected, 8000);
  assert.equal(t.aov, 3333);
  assert.equal(t.crossSellRevenue, 599);
  assert.equal(t.crossSellJobs, 1);
  assert.deepEqual(t.leadSources, [{ source: "WEBSITE", count: 2 }, { source: "GMB", count: 1 }]);
  assert.equal(t.otpIssued, 2);
  assert.equal(t.otpVerified, 1);
  assert.equal(t.otpCompliance, 50);
  const l = cc.lastWeek.m;
  assert.equal(l.leads, 1);
  assert.equal(l.completedJobs, 1);
  assert.equal(l.collectedOther, 4000);
  assert.equal(l.otpCompliance, 100);
  assert.equal(pctChange(t.grossRevenue, l.grossRevenue), 150);
  assert.equal(pctChange(5, 0), null);
  const empty = weekMetrics({ leads: [], jobsCreated: [], completed: [], payments: [] }, istWeekRange(NOW));
  assert.equal(empty.aov, 0);
  assert.equal(empty.otpCompliance, null, "no start codes issued → no compliance figure, not 0 %");
});

test("Command Center is Super Admin only: listed on the admin hub, hidden from every other role, page guarded server-side", () => {
  const tile = SETTINGS_PAGES.find((p) => p.href === "/admin/command-center");
  assert.ok(tile, "listed on Settings & Controls");
  assert.equal(canAccess("ADMIN", tile!.section), true);
  for (const r of ["ACCOUNTS", "OPERATIONS", "SUPERVISOR", "STAFF"]) assert.equal(canAccess(r, tile!.section), false, r);
  const page = readFileSync("src/app/(app)/admin/command-center/page.tsx", "utf8");
  assert.match(page, /requireRole\(\["ADMIN"\]\)/);
  assert.match(page, /getWeeklyCommandCenter\(\)/);
});
