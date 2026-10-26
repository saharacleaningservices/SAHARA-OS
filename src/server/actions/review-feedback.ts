"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { notify } from "@/server/notify";

/**
 * /review private feedback (owner 2026-10-26): a 1–3★ rating is captured here — stored as a Review row (so the
 * customer's history, Reports → Reviews and the "already reviewed" reminder check all see it) and alerted to the
 * team for a same-day call-back. Public, unauthenticated by design: IP rate-limited, text-only, linked to the job
 * when the link carried its booking token / short code.
 */
export async function submitPrivateFeedback(input: { rating: number; comment: string; t?: string | null; c?: string | null }) {
  const ip = clientIp(await headers());
  if (!rateLimit(`review-feedback:${ip}`, 5, 3600).allowed) return { ok: false as const, error: "Too many submissions — please try again later." };

  const rating = Math.round(Number(input.rating));
  if (!(rating >= 1 && rating <= 5)) return { ok: false as const, error: "Please choose a rating." };
  const comment = String(input.comment ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 1000);
  if (comment.length < 3) return { ok: false as const, error: "Please tell us briefly what went wrong." };

  const where = input.t && /^[A-Za-z0-9_-]{20,40}$/.test(input.t) ? { publicToken: input.t } : input.c && /^[A-Za-z0-9]{10}$/.test(input.c) ? { shortCode: input.c } : null;
  const job = where ? await db.job.findFirst({ where: { ...where, deletedAt: null }, select: { id: true, jobNumber: true, customerName: true, customerMobile: true } }).catch(() => null) : null;

  await db.review.create({
    data: {
      customerMobile: job?.customerMobile ?? "unknown",
      customerName: job?.customerName ?? null,
      rating,
      comment: `[Private feedback via /review] ${comment}`,
      jobId: job?.id ?? null,
    },
  });
  await notify({
    kind: "NEW_INQUIRY",
    title: `⚠️ ${rating}★ private feedback${job ? ` — ${job.customerName}` : ""}`,
    body: `${job ? `${job.jobNumber} · ` : ""}"${comment.slice(0, 120)}" — call the customer today`,
    href: job ? `/jobs/${job.id}` : "/reports",
  }).catch(() => {});
  return { ok: true as const };
}
