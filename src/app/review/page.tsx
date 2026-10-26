import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";
import { GOOGLE_REVIEW_URL } from "@/lib/whatsapp-cloud-templates";
import { reviewServiceOf } from "@/lib/review-chips";
import { ReviewFunnel } from "@/components/public/review-funnel";

// /review — Smart Review Funnel (owner 2026-10-25). WhatsApp "Rate Us on Google" lands here: the customer picks a natural
// keyword line for the service they had, it is copied to the clipboard, and "Paste & Post on Google" opens the Google
// review dialog. Optional ?t=<booking token> personalises the greeting and the service; without it the pool is general.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rate Sahara Cleaning Services on Google", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string; c?: string }> }) {
  const { t, c } = await searchParams;
  let name: string | null = null;
  let service: string | null = null;
  // ?t = booking token (WhatsApp template button), ?c = 10-char short code (plain-text completion message).
  const where = t && /^[A-Za-z0-9_-]{20,40}$/.test(t) ? { publicToken: t } : c && /^[A-Za-z0-9]{10}$/.test(c) ? { shortCode: c } : null;
  if (where) {
    const job = await db.job.findFirst({ where: { ...where, deletedAt: null }, select: { customerName: true, service: true } }).catch(() => null);
    if (job) {
      name = job.customerName.split(/\s+/)[0] || null;
      service = job.service;
    }
  }
  const settings = await db.companySettings.findUnique({ where: { id: "default" }, select: { googleReviewUrl: true } }).catch(() => null);
  return <ReviewFunnel name={name} serviceKey={reviewServiceOf(service)} serviceLabel={service ? (SERVICE_LABELS[service] ?? null) : null} reviewUrl={settings?.googleReviewUrl || GOOGLE_REVIEW_URL} token={t ?? null} code={c ?? null} />;
}
