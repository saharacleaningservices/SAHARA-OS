import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { COMPANY } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { verifyCrewCardToken } from "@/lib/crew-card-token";
import { getCrewCard } from "@/server/crew-card";
import { DocumentActions } from "@/components/public/document-actions";
import { INTERNAL_CRM_URL } from "@/lib/site-urls";

// /crew-card/{jobId}.{signature} — single-page A4 job card for the crew (Download PDF = the browser's Save as PDF).
// It shows ONLY job ID, service, package, date & slot, site address and the assigned team / supervisor: the customer phone
// and every amount are never loaded (see src/server/crew-card.ts). Signed link, no login, not indexed.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Job Card — Sahara Cleaning Services", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let jobId: string | null = null;
  try {
    jobId = verifyCrewCardToken(decodeURIComponent(token));
  } catch {
    jobId = null;
  }
  if (!jobId) notFound();
  const c = await getCrewCard(jobId);
  if (!c) notFound();
  const rows: [string, string | null][] = [
    ["Job ID", c.jobNumber],
    ["Service", c.service],
    ["Package", c.packageLabel],
    ["Date", formatDate(c.date)],
    ["Time slot", c.timeSlot],
    ["Team", [c.team, c.crew.join(", ")].filter(Boolean).join(" · ") || null],
    ["Supervisor", c.supervisor],
  ];
  return (
    <main className="min-h-screen bg-muted/30 px-3 py-6 print:bg-white print:p-0">
      <style>{"@media print{@page{size:A4;margin:8mm}html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}article{break-inside:avoid}}"}</style>
      <article className="mx-auto max-w-[210mm] space-y-4 rounded-xl border-2 border-[#0a2540]/15 bg-white p-5 text-[#0a2540] shadow-sm print:shadow-none">
        <header className="flex items-center justify-between gap-3 border-b-2 border-primary/30 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/sahara-logo.png" alt={COMPANY.name} className="h-14 w-auto" />
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Job Card · Crew copy</p>
            <p className="text-xl font-extrabold">{c.jobNumber}</p>
          </div>
        </header>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-dashed py-1">
                <dt className="text-[#0a2540]/60">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
        </dl>
        <section className="rounded-lg border p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Site address</p>
          <p className="text-sm">{c.address}</p>
          {c.mapLink && (
            <a href={c.mapLink} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary underline">
              <MapPin className="size-4" /> Open in Google Maps
            </a>
          )}
        </section>
        <p className="border-t pt-2 text-[11px] text-[#0a2540]/60">Customer contact and payments are handled only by the office. Questions: call the office.</p>
        <DocumentActions shareUrl={`${INTERNAL_CRM_URL}/crew-card/${token}`} title={`Job card ${c.jobNumber}`} />
      </article>
    </main>
  );
}
