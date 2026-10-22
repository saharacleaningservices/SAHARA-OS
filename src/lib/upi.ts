// UPI payment intent (the standard upi://pay link every UPI app — PhonePe, GPay, Paytm, BHIM — understands).
// Rendered as a QR on the customer invoice so the exact balance due is pre-filled.
export function upiPayUri(input: { upiId: string; payeeName: string; amount: number; note?: string }): string {
  const p = new URLSearchParams({
    pa: input.upiId.trim(),
    pn: input.payeeName.trim().slice(0, 60),
    am: (Math.round(input.amount * 100) / 100).toFixed(2),
    cu: "INR",
  });
  if (input.note) p.set("tn", input.note.trim().slice(0, 40));
  return `upi://pay?${p.toString()}`;
}
