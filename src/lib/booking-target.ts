// Single customer-facing booking target for every auto-responder, chatbot reply, SMS and template (owner 2026-10-26):
//   https://saharacleaningservices.com/booking
// Safe to import from server and client code (reads an optional env override only on the server).
//
// IMPORTANT (checked 2026-10-26): saharacleaningservices.com is still the old WordPress site and /booking there returns
// 404. Before this ships, add a 301 on the main site:  /booking  →  https://booking.saharacleaningservices.com/booking
// (query string preserved), or set CUSTOMER_BOOKING_URL in Coolify to the booking subdomain until the redirect is live.

export const DEFAULT_CUSTOMER_BOOKING_URL = "https://saharacleaningservices.com/booking";

export const CUSTOMER_BOOKING_URL = ((typeof process !== "undefined" && process.env?.CUSTOMER_BOOKING_URL) || DEFAULT_CUSTOMER_BOOKING_URL).replace(/\/$/, "");

export type BookingService = "home" | "commercial" | "pest" | "painting";

/** Booking link with an optional service pre-selected and UTM tags so the Marketing dashboard credits the channel. */
export function bookingLink(opts: { service?: BookingService; source?: string; medium?: string; campaign?: string } = {}): string {
  const q = new URLSearchParams();
  if (opts.service) q.set("service", opts.service);
  if (opts.source) q.set("utm_source", opts.source);
  if (opts.medium) q.set("utm_medium", opts.medium);
  if (opts.campaign) q.set("utm_campaign", opts.campaign);
  const qs = q.toString();
  // #book jumps straight to the booking wizard when a service is pre-selected (fragments survive the 301 redirect).
  return `${CUSTOMER_BOOKING_URL}${qs ? `?${qs}` : ""}${opts.service ? "#book" : ""}`;
}

/** Public trust facts shared by the booking page, schema, auto-responders and templates (owner-confirmed). */
export const TRUST = {
  rating: "4.9",
  reviewCount: 1800,
  reviewLabel: "1,800+",
  since: 2012,
  /** Meta WhatsApp Cloud API sender — automated booking assistant (messages only, no calls). */
  whatsappApi: "9175220270",
} as const;
