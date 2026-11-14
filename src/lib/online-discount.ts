// Flat online-booking discount (owner 2026-11-14): bookings made on the website (Pay After Service, no gateway yet) get 5% off every priced
// line, automatically. ONE rounding rule shared with the website (sahara-web lib/catalog.ts) so the CRM job value, the WhatsApp {{7}} amount and
// the Staff App UPI QR match the customer's checkout to the rupee. Pure.
export const ONLINE_BOOKING_DISCOUNT_PERCENT = 5;

export function onlineBookingDiscount(gross: number): { gross: number; discount: number; net: number } {
  const g = Math.max(0, Math.round(Number.isFinite(gross) ? gross : 0));
  const discount = Math.round((g * ONLINE_BOOKING_DISCOUNT_PERCENT) / 100);
  return { gross: g, discount, net: g - discount };
}
