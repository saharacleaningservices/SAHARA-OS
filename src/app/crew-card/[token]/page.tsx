import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { COMPANY } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { verifyCrewCardToken } from "@/lib/crew-card-token";
import { getCrewCard } from "@/server/crew-card";

// /crew-card/{jobId}.{signature} — A4 digital job card for the crew. Customer phone and amounts are never loaded (see
// src/server/crew-card.ts). Signed link, no login, not indexed.
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
    ["Date", formatDate(c.date)],
    ["Time slot", c.timeSlot],
    ["Area", c.area],
    ["Service", c.service],
    ["Package", [c.packageName, c.flatType && c.flatType !== c.packageName ? c.flatType : null].filter(Boolean).join(" · ") || null],
    ["Team", c.team ? `Team ${c.team}` : null],
    ["Supervisor", c.supervisor],
    ["Vehicle", c.vehicle],
  ];
  return (
    <main className="min-h-screen bg-muted/30 px-3 py-6 print:bg-white print:p-0">
      <article className="mx-auto max-w-[210mm] space-y-4 rounded-xl border bg-white p-5 text-[#0a2540] shadow-sm print:border-0 print:shadow-none">
        <header className="flex items-center justify-between gap-3 border-b pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/sahara-logo.png" alt={COMPANY.name} className="h-12 w-auto" />
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Job Card · Crew copy</p>
            <p className="text-lg font-extrabold">{c.jobNumber}</p>
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
        <section>
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Address</p>
          <p className="text-sm">{c.address}</p>
          {c.mapLink && (
            <a href={c.mapLink} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary underline">
              <MapPin className="size-4" /> Open in Google Maps
            </a>
          )}
        </section>
        {c.material.length > 0 && (
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Material issued</p>
            <p className="text-sm">{c.material.join(", ")}</p>
          </section>
        )}
        {c.scope.length > 0 && (
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Scope checklist</p>
            <ul className="mt-1 space-y-1 text-sm">
              {c.scope.map((x) => (
                <li key={x} className="flex gap-2">
                  <span aria-hidden>☐</span>
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {c.note && (
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Special note</p>
            <p className="text-sm">{c.note}</p>
          </section>
        )}
        <p className="border-t pt-2 text-[11px] text-[#0a2540]/60">Customer contact is shared only through the office. Questions: call the office.</p>
      </article>
    </main>
  );
}
