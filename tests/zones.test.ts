import test from "node:test";
import assert from "node:assert/strict";
import { resolveZone, checkMinimumOrder, customerTypeFor, minimumOrderValue, crmMinimumJobValue, ZONES } from "../src/lib/zones";

test("every listed locality resolves to its own zone", () => {
  for (const z of Object.values(ZONES)) {
    for (const l of z.localities) {
      assert.equal(resolveZone({ area: l })?.zone.id, z.id, `${l} should be ${z.id}`);
    }
  }
});

test("free-text areas, longest alias wins, pincode fallback", () => {
  assert.equal(resolveZone({ area: "Magarpatta City, Hadapsar" })?.zone.id, "ZONE_1");
  assert.equal(resolveZone({ area: "Pimple Saudagar" })?.zone.id, "ZONE_2");
  assert.equal(resolveZone({ area: "Pimpri Chinchwad" })?.zone.id, "ZONE_2");
  assert.equal(resolveZone({ area: "Talegaon Dabhade" })?.zone.id, "ZONE_3");
  assert.equal(resolveZone({ area: "Hinjewadi Phase 2" })?.zone.id, "ZONE_2"); // by name
  assert.equal(resolveZone({ area: "Hinjewadi Phase 2", pincode: "411057" })?.zone.id, "ZONE_2");
  assert.equal(resolveZone({ area: "", pincode: "411057" })?.zone.id, "ZONE_2"); // by pincode only
  assert.equal(resolveZone({ area: "somewhere", pincode: "411060" })?.zone.id, "ZONE_1");
  assert.equal(resolveZone({ area: "Mars" }), null);
  // "baner" must not match inside another word
  assert.equal(resolveZone({ area: "Banerjee Colony" }), null);
});

test("Zone 1 has no minimum order value", () => {
  assert.equal(minimumOrderValue("ZONE_1", "RESIDENTIAL"), 0);
  assert.deepEqual(checkMinimumOrder({ zone: "ZONE_1", customerType: "RESIDENTIAL", total: 499 }), { ok: true });
  assert.equal(crmMinimumJobValue("Kharadi", "RESIDENTIAL", 3999), 0);
});

test("Zone 2 enforces ₹4,000 with the exact message", () => {
  const low = checkMinimumOrder({ zone: "ZONE_2", customerType: "RESIDENTIAL", total: 3999 });
  assert.equal(low.ok, false);
  if (!low.ok) {
    assert.equal(low.min, 4000);
    assert.equal(low.message, "Minimum order value for West Pune & PCMC is ₹4,000. Please add more services or upgrade your package to proceed.");
  }
  assert.deepEqual(checkMinimumOrder({ zone: "ZONE_2", customerType: "RESIDENTIAL", total: 4000 }), { ok: true });
});

test("Zone 3: commercial free, residential ₹7,500", () => {
  assert.deepEqual(checkMinimumOrder({ zone: "ZONE_3", customerType: "COMMERCIAL", total: 1500 }), { ok: true });
  const low = checkMinimumOrder({ zone: "ZONE_3", customerType: "RESIDENTIAL", total: 7499 });
  assert.equal(low.ok, false);
  if (!low.ok) {
    assert.equal(low.message, "For Chakan, Moshi, Ravet, Talegaon & Alandi, we accept Commercial Cleaning projects or Full Home / Villa packages of ₹7,500 and above.");
  }
  assert.deepEqual(checkMinimumOrder({ zone: "ZONE_3", customerType: "RESIDENTIAL", total: 7500 }), { ok: true });
});

test("unmapped area keeps the legacy CRM floor; customer type detection", () => {
  assert.equal(crmMinimumJobValue("Unknown", "RESIDENTIAL", 3999), 3999);
  assert.equal(checkMinimumOrder({ zone: null, customerType: "RESIDENTIAL", total: 1 }).ok, true);
  assert.equal(customerTypeFor("COMMERCIAL_CLEANING"), "COMMERCIAL");
  assert.equal(customerTypeFor("HOME_DEEP_CLEANING"), "RESIDENTIAL");
  assert.equal(customerTypeFor("HOME_DEEP_CLEANING", "COMMERCIAL"), "COMMERCIAL");
});
