import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GOOGLE_REVIEW_URL, templateByName } from "../src/lib/whatsapp-cloud-templates";
import { buildMetaTemplatePayload, foreignUrlButtons, SUBMITTABLE_TEMPLATES } from "../src/lib/meta-template-payload";
import { WHATSAPP_TRANSACTIONAL_TEMPLATES } from "../src/lib/whatsapp";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("sahara_booking_confirmed_v7: Utility, 100% Pay After Service wording, no advance anywhere", () => {
  const t = templateByName("sahara_booking_confirmed_v7")!;
  assert.ok(t);
  assert.equal(t.category, "UTILITY");
  assert.equal(t.language, "en");
  assert.match(t.body, /Payment: 100% Pay After Service\. Nothing to pay in advance\. You pay once the service is completed\./);
  assert.ok(!/pay advance|advance payment|20%/i.test(JSON.stringify(t).replace("Nothing to pay in advance", "")), "no advance wording");
  assert.equal(t.footer, "Sahara Cleaning Services, Pune");
  assert.ok((t.footer ?? "").length <= 60);
  assert.equal(t.examples.length, 6);
  for (let i = 1; i <= 6; i++) assert.ok(t.body.includes(`{{${i}}}`));
  assert.ok(!t.body.includes("{{7}}"));
});

test("v7 buttons: View Booking (dynamic URL), Leave a Review (static URL), Pay After Service (quick reply, grouped last)", () => {
  const t = templateByName("sahara_booking_confirmed_v7")!;
  assert.deepEqual((t.buttons ?? []).map((b) => [b.type, b.text]), [["URL", "View Booking"], ["URL", "Leave a Review"], ["QUICK_REPLY", "Pay After Service"]]);
  const [view, review] = t.buttons as { type: "URL"; url: string; example?: string }[];
  assert.equal(view.url, "https://saharacleaningservices.com/booking/{{1}}");
  assert.equal(view.example, "https://saharacleaningservices.com/booking/AbCdEfGh1234567890");
  assert.equal(review.url, GOOGLE_REVIEW_URL);
  assert.equal(foreignUrlButtons(t).length, 0, "every link is on the booking domain or the Google review link");
});

test("v7 Meta payload: BODY + FOOTER + BUTTONS, example only on the dynamic URL, no header", () => {
  const p = buildMetaTemplatePayload(templateByName("sahara_booking_confirmed_v7")!) as { name: string; category: string; language: string; components: any[] };
  assert.equal(p.name, "sahara_booking_confirmed_v7");
  assert.equal(p.category, "UTILITY");
  assert.deepEqual(p.components.map((c) => c.type), ["BODY", "FOOTER", "BUTTONS"]);
  const b = p.components[2].buttons;
  assert.deepEqual(b[0].example, ["https://saharacleaningservices.com/booking/AbCdEfGh1234567890"]);
  assert.equal(b[1].example, undefined);
  assert.deepEqual(b[2], { type: "QUICK_REPLY", text: "Pay After Service" });
});

test("v7 is submittable and sendable only through its own switch; the current template stays the default", () => {
  assert.ok((SUBMITTABLE_TEMPLATES as readonly string[]).includes("sahara_booking_confirmed_v7"));
  assert.ok(WHATSAPP_TRANSACTIONAL_TEMPLATES.includes("sahara_booking_confirmed_v7"));
  const src = read("src/server/booking-messages.ts");
  assert.match(src, /WHATSAPP_BOOKING_TEMPLATE === "v7"/);
  assert.match(src, /templatesEnabled\(\) && bookingTemplateV7\(\)/);
  // The default (no switch) path is still the approved v1 template.
  assert.match(src, /templateByName\("sahara_booking_confirmed"\)!/);
});
