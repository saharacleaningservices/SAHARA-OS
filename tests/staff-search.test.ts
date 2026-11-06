import { test } from "node:test";
import assert from "node:assert/strict";
import { spellingVariants, staffSearchTokens } from "../src/lib/staff-search";

test("filler words around a name are dropped", () => {
  assert.deepEqual(staffSearchTokens("Mosek Uncle"), ["mosek"]);
  assert.deepEqual(staffSearchTokens("Hk Rahman"), ["rahman"]);
  assert.deepEqual(staffSearchTokens("uncle"), ["uncle"]);
});
test("spelling variants cover the CRM and Khatabook forms", () => {
  assert.ok(spellingVariants("bagwan").includes("bhagwan"));
  assert.ok(spellingVariants("mosek").includes("moses"));
  assert.ok(spellingVariants("shaikh").includes("sheikh"));
  assert.deepEqual(spellingVariants("kaleemx"), ["kaleemx"]);
});
