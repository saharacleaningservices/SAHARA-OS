import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFix, locationNote } from "../src/lib/geo";

test("cleanFix accepts a real fix and rejects junk from the client", () => {
  assert.deepEqual(cleanFix({ lat: 18.5086, lng: 73.9286, acc: 24.6 }), { lat: 18.5086, lng: 73.9286, acc: 25 });
  assert.deepEqual(cleanFix({ lat: 18.5, lng: 73.9 }), { lat: 18.5, lng: 73.9 });
  for (const bad of [null, undefined, "18,73", {}, { lat: "18", lng: 73 }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: NaN, lng: 1 }]) assert.equal(cleanFix(bad), null);
});

test("locationNote writes coordinates and a map link, or says location was not captured", () => {
  const n = locationNote({ lat: 18.50863, lng: 73.92985, acc: 25 });
  assert.match(n, /location 18\.50863, 73\.92985 \(±25 m\)/);
  assert.match(n, /https:\/\/maps\.google\.com\/\?q=18\.50863,73\.92985/);
  assert.equal(locationNote(null), " · location not captured");
});
