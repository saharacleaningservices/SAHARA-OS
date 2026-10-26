// UPI payment intent in the exact format every UPI app (PhonePe, GPay, Paytm, BHIM) scans (owner 2026-10-23):
//   upi://pay?pa=<upi id>&pn=Sahara%20Cleaning%20Services&am=<amount>&cu=INR
// Spaces are %20 (not "+", which some apps show literally). The amount is the exact amount to pay, to the paisa.
export function upiPayUri(input: { upiId: string; payeeName: string; amount?: number | null }): string {
  const am = input.amount && input.amount > 0 ? `&am=${Number.isInteger(input.amount) ? input.amount : input.amount.toFixed(2)}` : "";
  return `upi://pay?pa=${encodeURIComponent(input.upiId.trim()).replace(/%40/g, "@")}&pn=${encodeURIComponent(input.payeeName.trim().slice(0, 60))}${am}&cu=INR`;
}

/** QR options for payment codes: a full 4-module quiet zone and a high-resolution image, so phone cameras lock on instantly. */
export const UPI_QR_OPTIONS = { margin: 4, width: 640, errorCorrectionLevel: "M" as const };
