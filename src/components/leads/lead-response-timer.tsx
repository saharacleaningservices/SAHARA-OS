"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatWait, isLeadResponseOverdue, leadWaitMs, LEAD_RESPONSE_SLA_MS } from "@/lib/lead-response";
import { cn } from "@/lib/utils";

/**
 * Waiting-time chip for NEW leads: amber while inside the 15-minute SLA, red once it is breached. Renders nothing for leads
 * that have been worked. One 30 s timer per visible chip, and only while the lead is still NEW — no network traffic.
 */
export function LeadResponseTimer({ stage, createdAt, className }: { stage: string; createdAt: Date | string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stage !== "NEW") return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [stage]);
  if (stage !== "NEW") return null;
  const overdue = isLeadResponseOverdue(stage, createdAt, now);
  const wait = leadWaitMs(createdAt, now);
  return (
    <span
      title={overdue ? `Uncontacted for ${formatWait(wait)} — call now` : `Respond within ${Math.round(LEAD_RESPONSE_SLA_MS / 60000)} min`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
        overdue ? "bg-destructive text-white" : "bg-warning/15 text-warning",
        className,
      )}
    >
      <Timer className="size-3" /> {overdue ? `Uncontacted ${formatWait(wait)}` : formatWait(wait)}
    </span>
  );
}
