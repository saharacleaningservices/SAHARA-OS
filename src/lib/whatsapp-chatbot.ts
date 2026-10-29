// In-house WhatsApp booking chatbot (owner 2026-10-26) — zero monthly cost, no WATI / AiSensy.
// Pure rules: the webhook (src/app/api/webhooks/whatsapp/route.ts) sends the menu as a native Cloud API interactive
// LIST (Meta reply buttons are capped at 3, the menu has 4 choices) and answers each tap with a direct booking link.
// Every link goes to the single booking target (lib/booking-target.ts) with the service pre-selected and UTM tags
// (utm_source=whatsapp&utm_medium=chatbot) so Marketing → Sources credits the bot.

import { bookingLink, TRUST, type BookingService } from "@/lib/booking-target";

/** Short greeting / buying-intent openers that get the menu. Long free-text questions go to the team (and AI if enabled). */
export const BOT_TRIGGER = /^(hi+|hii+|hello+|helo|hey+|namaste|namaskar|hlo|menu|book|booking|book now|price|prices|rate|rates|quote|quotation|enquiry|inquiry|cleaning|deep cleaning|slot|slots|available|availability|info)\b[\s!.?,]*$/i;

export function isBotTrigger(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= 40 && BOT_TRIGGER.test(t);
}

export type BotRow = { id: string; title: string; description: string };

/** Row titles ≤ 24 chars, descriptions ≤ 72 chars (Meta list limits). */
export const BOT_ROWS: BotRow[] = [
  { id: "bot_home", title: "Deep Cleaning & Offers", description: "1–3 BHK packages, combos from ₹1,899, sofa & kitchen" },
  { id: "bot_pest", title: "Pest Control", description: "Cockroach & ant ₹999 · Bed bug ₹1,199 · Termite on inspection" },
  { id: "bot_painting", title: "Painting & Waterproofing", description: "Interior painting, damp & leakage repair — free inspection" },
  { id: "bot_status", title: "Booking / Crew Status", description: "Check your booking date, slot and crew status" },
];
/** Menu row → CRM service (ServiceType) used to tag the lead when a customer taps it. Rows not listed (status/slots) don't change the service. */
export const BOT_ROW_SERVICE: Record<string, "HOME_DEEP_CLEANING" | "COMMERCIAL_CLEANING" | "PEST_CONTROL" | "INTERIOR_PAINTING"> = {
  bot_home: "HOME_DEEP_CLEANING",
  bot_sofa: "HOME_DEEP_CLEANING",
  bot_pest: "PEST_CONTROL",
  bot_painting: "INTERIOR_PAINTING",
  bot_commercial: "COMMERCIAL_CLEANING",
};
// Earlier menus (still in customers' chat history) keep working when tapped.
const LEGACY_BOT_IDS = ["bot_sofa", "bot_commercial", "bot_slots"];

export const isBotRow = (id: string | null | undefined) => !!id && (BOT_ROWS.some((r) => r.id === id) || LEGACY_BOT_IDS.includes(id));

export function botMenu(opening?: string) {
  return {
    bodyText: opening ?? `Welcome to Sahara Cleaning Services — Pune's trusted cleaning team since ${TRUST.since} (${TRUST.rating}★ on Google, ${TRUST.reviewLabel} reviews). What would you like to book?`,
    buttonLabel: "Choose a service",
    rows: BOT_ROWS,
  };
}

/** Opening line for a brand-new enquiry (replaces the old plain-text acknowledgement — one message, not two). */
export const NEW_ENQUIRY_OPENING = "Thanks for reaching out to Sahara Cleaning Services! Our team will reply shortly. Meanwhile, pick a service to see prices and book an available slot instantly:";

const link = (service?: BookingService, campaign = "menu") => bookingLink({ service, source: "whatsapp", medium: "chatbot", campaign });

/** Reply text for a menu tap, or null for an unknown row id. */
export function botReply(rowId: string): string | null {
  switch (rowId) {
    case "bot_home":
      return `🏠 *Home Deep Cleaning*\nFull-home deep cleaning by trained in-house teams with machines and safe chemicals: every room, kitchen, bathrooms, windows and balconies.\n\nSee packages, pick your date and an available slot here:\n${link("home", "home_deep_cleaning")}\n\nPay after service · GST invoice available.`;
    case "bot_pest":
      return `🪳 *Pest Control*\nCockroach & ant control from ₹999 · Bed bug treatment from ₹1,199 · Termite, rodent & mosquito control after a free inspection.\n\nPick a date and slot here:\n${link("pest", "pest_control")}`;
    case "bot_painting":
      return `🎨 *Interior Painting & Waterproofing*\nDust-free interior painting, damp and leakage patchwork and waterproofing. Every job starts with a free site inspection and a written quote.\n\nBook your free inspection here:\n${link("painting", "painting_waterproofing")}`;
    case "bot_status":
      return `📋 *Booking / Crew Status*\nWe couldn't find an upcoming booking for this number. If you booked from another number, reply with your booking ID or name and our team will update you.\n\nNew booking: ${link(undefined, "status_new")}`;
    case "bot_sofa":
      return `🛋️ *Sofa / Carpet / Mattress Cleaning*\nShampooing and hot-water extraction that lifts stains, dust mites and odour.\n\nChoose seats / sizes and book a slot here:\n${link("home", "sofa_carpet")}`;
    case "bot_commercial":
      return `🏢 *Commercial & Office Cleaning*\nOffice deep cleaning, floor scrubbing, glass & facade, post-construction cleaning and monthly housekeeping contracts (AMC).\n\nBook a visit or a cleaning slot here:\n${link("commercial", "commercial")}\n\nFor larger sites we share a written quotation after a free site visit.`;
    case "bot_slots":
      return `📅 *Live slot availability*\nOpen dates and time slots update in real time on our booking page — pick one and it is reserved for you:\n${link(undefined, "slot_availability")}\n\nNeed help? Reply here and our team will assist.`;
    default:
      return null;
  }
}
