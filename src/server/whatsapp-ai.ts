import { PRICING_MASTER, PRICING_NOTICE, pricesIn, priceLabel, HOME_FROM_PRICE } from "@/lib/pricing-master";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";

// Grounded WhatsApp assistant (Sahara Marketing number). Deterministic by
// design: every answer is assembled ONLY from the pricing master, the
// approved landing-page facts below and the booking link. It never states
// availability, discounts, offers, policies or prices that aren't in those
// sources — anything it can't answer from them is handed to a human.
//
// Returns { reply } for a grounded answer, or { handoff } when staff must
// take over (the webhook then switches the conversation to HUMAN and alerts
// the team). Only runs when WHATSAPP_AI_ENABLED=on AND the conversation is in
// AI mode AND auto-replies are allowed (see the webhook).

const BOOK = `${PUBLIC_BOOKING_URL}/booking`;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export type AiResult = { reply: string; handoff?: undefined } | { handoff: string; reply?: string };

const HANDOFF_ACK = "Thanks! A member of our team will reply to you here shortly.";

function packagesText(tier: "PREMIUM" | "PLATINUM") {
  return pricesIn(tier)
    .map((p) => `• ${p.bhk}: ${inr(p.price!)}${p.mrp ? ` (was ${inr(p.mrp)})` : ""}`)
    .join("\n");
}

function customisedText() {
  return pricesIn("CUSTOMISED")
    .map((p) => `• ${p.name}: ${priceLabel(p)}${p.rule ? ` — ${p.rule}` : ""}`)
    .join("\n");
}

// Word-start match, so "hi" doesn't match inside "this" and "rate" not inside "separate".
const has = (t: string, ...words: string[]) => words.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t));

export function answerWhatsApp(raw: string): AiResult {
  const t = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return { handoff: "empty or non-text message" };

  // Anything that needs a person: complaints, changes to an existing booking,
  // payments, custom quotes, commercial/pest/painting estimates, human request.
  if (has(t, "complain", "refund", "damage", "angry", "not happy", "problem", "issue")) return { handoff: "complaint / issue" };
  if (has(t, "cancel", "reschedule", "postpone", "change date", "change time")) return { handoff: "existing booking change" };
  if (has(t, "paid", "payment", "upi", "invoice", "bill")) return { handoff: "payment question" };
  if (has(t, "human", "agent", "call me", "talk to", "speak to", "person")) return { handoff: "customer asked for a person" };
  if (has(t, "office", "shop", "commercial", "warehouse", "clinic", "society", "pest", "cockroach", "termite", "bed bug", "curtain", "fridge", "carpet")) {
    return { handoff: "inspection-based / no approved price" };
  }
  if (has(t, "quote", "quotation", "custom", "discount", "offer", "cheaper", "negotiat")) return { handoff: "custom quote / offer request" };

  // Grounded answers.
  if (has(t, "paint")) {
    const rates = pricesIn("PAINTING")
      .filter((p) => !p.addOnOnly)
      .map((p) => `• ${p.name}: ${priceLabel(p)}`)
      .join("\n");
    return { reply: `Interior painting is priced per sq ft (estimate — final price after site measurement):\n${rates}\n\nBook a site visit: ${BOOK}?service=painting` };
  }
  if (has(t, "platinum")) {
    return { reply: `Platinum Home Deep Cleaning (full scope + wall wet cleaning + ceiling dry dusting):\n${packagesText("PLATINUM")}\n\nBook online with live available slots: ${BOOK}\n\n${PRICING_NOTICE}` };
  }
  if (has(t, "premium", "bhk", "deep clean", "home clean", "full house")) {
    return {
      reply: `Home Deep Cleaning — transparent package prices:\n\nPremium (wall & ceiling dry dusting):\n${packagesText("PREMIUM")}\n\nPlatinum (adds wall wet cleaning):\n${packagesText("PLATINUM")}\n\nBook online with live available slots: ${BOOK}\n\n${PRICING_NOTICE}`,
    };
  }
  if (has(t, "sofa", "bathroom", "kitchen", "mattress", "window", "customi")) {
    return { reply: `Customised cleaning prices:\n${customisedText()}\n\nChoose quantities and book here: ${BOOK}\n\n${PRICING_NOTICE}` };
  }
  if (has(t, "price", "rate", "cost", "charges", "how much")) {
    return { reply: `Home deep cleaning starts from ${inr(HOME_FROM_PRICE)} (1 BHK Premium). See all transparent prices and book: ${BOOK}\n\nFor office, pest control or painting, reply with your requirement and our team will help.` };
  }
  if (has(t, "book", "slot", "available", "date", "appointment", "schedule")) {
    return { reply: `You can pick a date and a live available time slot here: ${BOOK}\nYour booking is confirmed once our team verifies the slot.` };
  }
  if (has(t, "service", "what do you do", "hi", "hello", "hey", "namaste")) {
    const n = PRICING_MASTER.length > 0;
    return n
      ? { reply: `Hello from Sahara Cleaning Services 👋\nWe offer home deep cleaning, customised cleaning (sofa, bathroom, kitchen, mattress, windows), commercial cleaning, pest control and interior painting across Pune & PCMC.\n\nSee prices and book: ${BOOK}\nOr tell us what you need and our team will help.` }
      : { handoff: "no approved data" };
  }
  return { handoff: "question outside approved data" };
}

export { HANDOFF_ACK };
