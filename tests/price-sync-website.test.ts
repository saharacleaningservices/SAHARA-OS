import { test } from "node:test";
import assert from "node:assert/strict";
import { PRICING_MASTER } from "../src/lib/pricing-master";

// CRM Price Master = the live website rate card (sahara-web lib/catalog.ts + pest/home pages), synced 2026-11-14.
const p = (id: string) => PRICING_MASTER.find((i) => i.contentId === id)!;

test("regular services and add-ons match the website prices", () => {
  const web: Record<string, number> = {
    "SCS-01": 4499, "SCS-02": 5499, "SCS-03": 6999, // home deep cleaning, Premium
    "SCS-05": 5499, "SCS-06": 6499, "SCS-07": 7999, // Platinum
    "SCS-12": 1999, // kitchen
    "SCS-10": 599, // bathroom (each, min 2)
    "SCS-09": 199, // sofa per seat
    "SCS-11": 799, // mattress
    "SCS-13": 599, // carpet
    "SCS-30": 299, "SCS-34": 499, // window, balcony
    "SCS-35": 599, // chimney
    "SCS-32": 499, // fridge inside
    "SCS-36": 1199, // kitchen pest control (add-on)
    "SCS-26": 3499, "SCS-27": 3999, "SCS-29": 3999, "SCS-RC-1": 2799, "SCS-RC-2": 2199, "SCS-RC-3": 1899, // combos
    "SCS-PC-1": 899, "SCS-PC-2": 1099, "SCS-PC-3": 1299, // general pest control 1/2/3 BHK
    "SCS-BB-1": 1199, "SCS-BB-2": 1499, "SCS-BB-3": 1799, // bed bugs 1/2/3 BHK
    "SCS-PC-ROD": 1499, // rodent
  };
  for (const [id, price] of Object.entries(web)) assert.equal(p(id)?.price, price, id);
});

test("website quantity rules agree with the CRM: no CRM minimum above what the website sells", () => {
  assert.equal(p("SCS-11").minQty, 1);
  assert.equal(p("SCS-10").minQty, 2);
  assert.equal(p("SCS-36").addOnOnly, true);
  assert.equal(p("SCS-17").price, null, "termite stays inspection-based (from ₹2,999)");
  assert.match(p("SCS-17").priceNote ?? "", /2,999/);
});
