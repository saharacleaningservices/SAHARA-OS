import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGstr1Sheets, gstDate, returnPeriod, splitInclusive, type GstLine } from "../src/lib/gstr1";

const d = (iso: string) => new Date(`${iso}T12:00:00+05:30`);
const line = (o: Partial<GstLine>): GstLine => ({ date: d("2025-07-30"), no: "SC/SL/25-26/106", party: "Acme", gstin: "", service: "Deep cleaning", taxable: 1000, gst: 180, rate: 18, total: 1180, source: "CRM", ...o });

test("GST offline-tool date and return period, in IST", () => {
  assert.equal(gstDate(new Date("2026-03-31T20:00:00Z")), "01-Apr-2026");
  assert.equal(returnPeriod(d("2026-11-06")), "112026");
});
test("inclusive split at 18%", () => {
  assert.deepEqual(splitInclusive(129800), { taxable: 110000, gst: 19800 });
});
test("B2B rows need a GSTIN; others aggregate into B2CS per period and rate", () => {
  const s = buildGstr1Sheets([
    line({ gstin: "27AAPFU0939F1ZV", no: "SC/SL/25-26/106" }),
    line({ no: "SC/SL/25-26/107" }),
    line({ no: "SC/SL/25-26/108", date: d("2025-07-02") }),
    line({ no: "SC/SL/25-26/109", gst: 0, taxable: 500, total: 500 }), // non-GST bill: not in GSTR-1
  ]);
  assert.equal(s.b2b.length, 1);
  assert.equal(s.b2b[0]["Place Of Supply"], "27-Maharashtra");
  assert.equal(s.b2b[0].CGST, 90);
  assert.equal(s.b2b[0].SAC, "998533");
  assert.equal(s.b2cs.length, 1);
  assert.equal(s.b2cs[0]["Taxable Value"], 2000);
  assert.equal(s.b2cs[0]["Return Period"], "072025");
  assert.equal(s.docs[0]["Total Number"], 3);
  assert.equal(s.docs[0]["Sr. No. From"], "SC/SL/25-26/106");
  assert.equal(s.summary[0]["Financial Year"], "2025-26");
  assert.equal(s.summary[0]["Total GST"], 540);
});
test("HSN summary splits by SAC", () => {
  const s = buildGstr1Sheets([line({ service: "PEST_CONTROL" }), line({ service: "INTERIOR_PAINTING" }), line({})]);
  assert.deepEqual(s.hsn.map((h) => h.HSN).sort(), ["995471", "998531", "998533"]);
});
