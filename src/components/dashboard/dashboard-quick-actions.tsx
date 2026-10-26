import Link from "next/link";
import { UserPlus, ClipboardList, Route, Wallet, Users, IndianRupee } from "lucide-react";

// Sahara CRM Dashboard Redesign — Phase 1: one-tap actions for the four
// most common things done from the dashboard.
// One intake: a Lead becomes a Job only through Confirm Booking — no "New Job" tile.
const ACTIONS = [
  { href: "/leads/new", label: "New Lead", icon: UserPlus },
  { href: "/leads", label: "Leads / CRM", icon: Users },
  { href: "/leads/price-list", label: "Price List", icon: IndianRupee },
  { href: "/jobs", label: "Jobs", icon: ClipboardList },
  { href: "/jobs/dispatch", label: "Dispatch Team", icon: Route },
  { href: "/payments", label: "Record Payment", icon: Wallet },
] as const;

// showPayments=false (SUPERVISOR/OPERATIONS field-restricted policy) drops
// the "Record Payment" tile; showNewLead=false (OPERATIONS since 2026-09-25,
// having lost "leads" nav access) drops "New Lead" — both would otherwise be
// dead-end tiles linking to a now-blocked page for that role.
export function DashboardQuickActions({ showPayments = true, showNewLead = true }: { showPayments?: boolean; showNewLead?: boolean }) {
  const actions = ACTIONS.filter((a) => (showPayments || a.href !== "/payments") && (showNewLead || !a.href.startsWith("/leads")));
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {actions.map(({ href, label, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card py-3.5 text-center transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sahara-shadow"
        >
          <Icon className="size-5 text-primary" />
          <span className="text-xs font-medium text-foreground">{label}</span>
        </Link>
      ))}
    </div>
  );
}
