"use client";

import { useState } from "react";
import { History, Loader2, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ContactTypeBadge } from "@/components/customers/contact-badges";
import { formatINR, formatDate } from "@/lib/utils";

type Timeline = {
  id: string; jobNumber: string; date: string; service: string; package: string | null; status: string; team: string | null;
  jobValue?: number; paid?: number; quotation?: { number: string; href: string };
};
type Data = {
  name: string; category: string; categoryLabel: string; customerNumber?: string | null; bookings: number; mobile?: string;
  lifetimeValue?: number; outstanding?: number; timeline: Timeline[];
};

/**
 * Small history icon next to a customer name. History is fetched from /api/customers/history only when it is
 * clicked — list pages never preload it. Pass `jobId` where the viewer may not see the mobile (Operations).
 */
export function CustomerHistoryButton({ mobile, jobId, name }: { mobile?: string; jobId?: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function load() {
    setState("loading");
    try {
      const qs = jobId ? `jobId=${encodeURIComponent(jobId)}` : `mobile=${encodeURIComponent(mobile ?? "")}`;
      const res = await fetch(`/api/customers/history?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Data);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); if (!data) void load(); }}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`History of ${name}`}
        title="Customer history"
      >
        <History className="size-4" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:w-[26rem]">
          <SheetHeader className="border-b pr-10">
            <SheetTitle>{data?.name ?? name}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2">
              {data && <ContactTypeBadge type={data.category} />}
              {data?.customerNumber && <span className="font-semibold text-foreground">{data.customerNumber}</span>}
              {data?.mobile && <span className="tabular-nums">{data.mobile}</span>}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            {state === "loading" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading history…</p>}
            {state === "error" && (
              <p className="text-sm text-destructive">
                Could not load history. <button type="button" className="underline" onClick={() => void load()}>Retry</button>
              </p>
            )}
            {data && state === "idle" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Bookings" value={String(data.bookings)} />
                  {data.lifetimeValue !== undefined && <Stat label="Lifetime value" value={formatINR(data.lifetimeValue)} />}
                  {!!data.outstanding && <Stat label="Outstanding" value={formatINR(data.outstanding)} warn />}
                </div>
                {data.timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No past services yet.</p>
                ) : (
                  <ol className="space-y-3 border-l pl-4">
                    {data.timeline.map((t) => (
                      <li key={t.id} className="relative">
                        <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
                        <p className="text-sm font-semibold leading-tight">{t.package ? `${t.service} — ${t.package}` : t.service}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(t.date)} · {t.jobNumber} · {t.status.replace(/_/g, " ").toLowerCase()}</p>
                        {t.team && <p className="text-xs text-muted-foreground">Team: {t.team}</p>}
                        {(t.paid !== undefined || t.jobValue !== undefined) && (
                          <p className="text-xs">
                            {t.jobValue !== undefined && <>Value {formatINR(t.jobValue)}</>}
                            {t.paid !== undefined && <>{t.jobValue !== undefined && " · "}Paid {formatINR(t.paid)}</>}
                          </p>
                        )}
                        {t.quotation && (
                          <a href={t.quotation.href} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                            <FileText className="size-3" /> Quotation {t.quotation.number}
                          </a>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={`text-base font-bold tabular-nums ${warn ? "text-red-600" : ""}`}>{value}</p>
    </div>
  );
}
