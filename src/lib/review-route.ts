// Review redirector rule (owner 2026-10-26): no rating yet → ask; 4–5★ → Google review flow; 1–3★ → private CRM feedback.
export type ReviewRoute = "ASK" | "GOOGLE" | "PRIVATE";

export function reviewRoute(rating: number | null | undefined): ReviewRoute {
  if (rating == null || !Number.isFinite(rating) || rating < 1) return "ASK";
  return rating >= 4 ? "GOOGLE" : "PRIVATE";
}
