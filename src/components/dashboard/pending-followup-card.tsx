import Link from "next/link";
import { PhoneMissed, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { SERVICE_LABELS } from "@/lib/constants";
import { CALL_FOLLOWUP_MINUTES, CALL_CLICK_HEADER } from "@/lib/call-click";
import { formatDateTime } from "@/lib/utils";

type Row = { id: string; leadNumber: string; name: string; service: string; area: string; createdAt: Date; acquisitionChannel: string | null };

/** Admin dashboard: NEW leads nobody has called within 15 minutes (owner 2026-11-13). Hidden entirely when the list is empty. */
export function PendingFollowUpCard({ rows, total }: { rows: Row[]; total: number }) {
  if (total === 0) return null;
  return (
    <Card className="border-amber-400/60 bg-amber-50/40">
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2">
          <PhoneMissed className="size-4 text-amber-700" /> Pending Follow-up
          <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs font-semibold text-white">{total}</span>
        </CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">New leads not marked Called within {CALL_FOLLOWUP_MINUTES} minutes — call, then log the call on the lead.</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.length === 0 ? (
          <EmptyState title="All caught up" description="Every new lead has been called." />
        ) : (
          rows.map((l) => (
            <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-amber-100/60">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {l.name}
                  {l.name.startsWith(CALL_CLICK_HEADER) ? "" : l.acquisitionChannel ? <span className="ml-2 text-[11px] font-normal text-muted-foreground">{l.acquisitionChannel}</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {l.leadNumber} · {SERVICE_LABELS[l.service as keyof typeof SERVICE_LABELS] ?? l.service} · {l.area} · Received {formatDateTime(l.createdAt)}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
