import type { Metadata } from "next";
import ReviewPage from "../page";

// /review/{token} — path form of the Smart Review Funnel (owner 2026-10-26). Same page as /review?t=… : pre-written review lines for the
// service, "Copy & Post to Google". Accepts the booking token (20–40 chars) or the 10-character short code from the text message.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rate Sahara Cleaning Services on Google", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const value = decodeURIComponent(token);
  return ReviewPage({ searchParams: Promise.resolve(value.length === 10 ? { c: value } : { t: value }) });
}
