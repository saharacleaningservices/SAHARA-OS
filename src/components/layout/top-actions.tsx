import Link from "next/link";
import { UserPlus, CalendarCheck, Truck } from "lucide-react";

/**
 * The three primary actions under the top bar (owner 2026-11-06): + New Lead, Slot Availability, Today's Dispatch.
 * Package Calculator and Send Offer were removed from the bar — the calculator stays on the Quick Quote, Price List and Customers
 * pages. Layout: FLUID — one scrollable row on phones, 44px-high touch targets.
 */
export function TopActions() {
  const base = "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold";
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-card/60 px-4 py-2 sm:px-6">
      <Link href="/leads/new" className={`${base} bg-primary text-primary-foreground hover:opacity-90`}>
        <UserPlus className="size-3.5" /> New Lead
      </Link>
      <Link href="/jobs/slots" className={`${base} border border-border text-foreground hover:border-primary/40`}>
        <CalendarCheck className="size-3.5 text-primary" /> Slot Availability
      </Link>
      <Link href="/jobs/dispatch" className={`${base} border border-border text-foreground hover:border-primary/40`}>
        <Truck className="size-3.5 text-primary" /> Today&apos;s Dispatch
      </Link>
    </div>
  );
}
