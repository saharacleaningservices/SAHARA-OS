import { test } from "node:test";
import assert from "node:assert/strict";
import { decideParty, docTypeOf, mergeSegment, nameSimilarity, statusOf } from "../src/lib/mbb-sync";

test("perfect match needs the same mobile and the same name, ignoring titles", () => {
  assert.equal(decideParty({ mobileValid: true, protectedNumber: false, memberCount: 1, crmName: "Anurag Nema", mbbNames: ["Mr. Anurag Nema"] }), "ATTACH");
});
test("different name on the same mobile is a conflict, never attached", () => {
  assert.equal(decideParty({ mobileValid: true, protectedNumber: false, memberCount: 1, crmName: "Shweta Desai", mbbNames: ["Panther Nails"] }), "NAME_CONFLICT");
});
test("partial name goes to review", () => {
  assert.equal(decideParty({ mobileValid: true, protectedNumber: false, memberCount: 1, crmName: "Rohan Shukla Sir", mbbNames: ["Rohan Patil"] }), "PARTIAL_MATCH");
});
test("several parties on one mobile always go to review", () => {
  assert.equal(decideParty({ mobileValid: true, protectedNumber: false, memberCount: 2, crmName: "Ghule", mbbNames: ["Ghule", "Arc"] }), "MULTI_PARTY");
  assert.equal(decideParty({ mobileValid: true, protectedNumber: false, memberCount: 2, crmName: null, mbbNames: ["A", "B"] }), "NEW_MULTI_PARTY");
});
test("new single party is created; owner numbers and bad mobiles are never touched", () => {
  assert.equal(decideParty({ mobileValid: true, protectedNumber: false, memberCount: 1, crmName: null, mbbNames: ["New Client"] }), "CREATE_AND_ATTACH");
  assert.equal(decideParty({ mobileValid: true, protectedNumber: true, memberCount: 1, crmName: null, mbbNames: ["x"] }), "PROTECTED");
  assert.equal(decideParty({ mobileValid: false, protectedNumber: false, memberCount: 1, crmName: null, mbbNames: ["x"] }), "INVALID_MOBILE");
});
test("paid status follows the remaining amount; types map", () => {
  assert.equal(statusOf("SALES_INVOICE", 0), "Paid");
  assert.equal(statusOf("SALES_INVOICE", 1500), "Unpaid");
  assert.equal(docTypeOf("payment_in"), "PAYMENT_IN");
  assert.equal(docTypeOf("credit_memo"), "CREDIT_NOTE");
});
test("segment merge", () => {
  assert.equal(mergeSegment(null, "B2C"), "B2C");
  assert.equal(mergeSegment("B2C", "B2B"), "BOTH");
  assert.equal(mergeSegment("B2B", "B2B"), "B2B");
  assert.ok(nameSimilarity("Abhishek Rao", "Abhishek") >= 0.99);
});
