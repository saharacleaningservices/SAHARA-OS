"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, ListChecks, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getOwnerInquiryTracker } from "@/server/actions/owner-inquiry";
import { StatusPill, seenTone } from "@/components/shared/status-pill";

type Rows = NonNullable<Awaited<ReturnType<typeof getOwnerInquiryTracker>>>;

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/**
 * Altaf's single place to follow his direct inquiries: who was alerted and who has seen it, every one-click
 * outcome (who, what, when, note, next follow-up) and whether the CRM itself confirms a quotation / booking.
 */
export function OwnerInquiryTracker() {
  const [rows, setRows] = useState<Rows | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const r = await getOwnerInquiryTracker().catch(() => null);
    if (r) setRows(r);
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
    // Poll only while the tab is visible (saves phone data/battery and server load); catch up on return.
    const id = setInterval(() => document.visibilityState === "visible" && void load(), 60_000);
    const onVisible = () => document.visibilityState === "visible" && void load();
    const onChanged = () => void load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("sahara:pending-changed", onChanged);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("sahara:pending-changed", onChanged);
    };
  }, [load]);

  if (!rows || rows.length === 0) return null;

  return (
    <Card id="inquiry-tracker">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <ListChecks className="size-4 text-primary" /> My inquiries — follow-up tracker
          </span>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={busy} aria-label="Refresh tracker">
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Inquiries you added directly (last 30 days). Outcomes are what Shoyab / Francis reported with one click.</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => {
            const latest = r.outcomes[0];
            const isOpen = open === r.leadId;
            return (
              <li key={r.leadId} className="px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/leads/${r.leadId}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                      {r.leadNumber}
                    </Link>{" "}
                    <span className="font-medium">{r.name}</span> <span className="text-xs text-muted-foreground">+91 {r.mobile}</span>
                    <p className="text-[11px] text-muted-foreground">
                      Added {fmt(r.createdAt)} · {r.source ?? "—"} · stage {r.stage.replaceAll("_", " ").toLowerCase()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.recipients.map((p) => (
                      <StatusPill
                        key={p.name}
                        tone={seenTone(p.role, !!p.seenAt)}
                        icon={p.seenAt ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                        title={p.seenAt ? `Seen ${fmt(p.seenAt)}` : "Alert not acknowledged yet"}
                      >
                        {p.name.split(" ")[0]} {p.seenAt ? "saw it" : "pending"}
                      </StatusPill>
                    ))}
                    {latest ? (
                      <StatusPill tone="muted" className="text-foreground">
                        {latest.label} · {latest.by.split(" ")[0]}
                      </StatusPill>
                    ) : (
                      <StatusPill>No outcome yet</StatusPill>
                    )}
                    {r.outcomes.length > 0 && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.leadId)}>
                        {isOpen ? "Hide history" : `History (${r.outcomes.length})`}
                      </Button>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <ul className="mt-2 space-y-1.5 border-l-2 pl-3">
                    {r.outcomes.map((o) => (
                      <li key={o.id} className="text-xs">
                        <span className="font-semibold">{o.label}</span> · {o.by} ({o.role === "ACCOUNTS" ? "Accounts" : o.role === "OPERATIONS" ? "Operations" : "Admin"}) · {fmt(o.at)}
                        {o.note ? <span className="text-muted-foreground"> — {o.note}</span> : null}
                        {o.nextFollowUpAt ? <span className="text-muted-foreground"> · next follow-up {fmt(o.nextFollowUpAt)}</span> : null}
                        <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${o.check.state === "CONFIRMED" ? "bg-success/15 text-success" : o.check.state === "NOT_CONFIRMED" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>{o.check.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
