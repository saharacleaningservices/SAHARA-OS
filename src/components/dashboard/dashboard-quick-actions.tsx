import Link from "next/link";
import { UserPlus, ClipboardList, Route, Wallet } from "lucide-react";

// Sahara CRM Dashboard Redesign — Phase 1: one-tap actions for the four
// most common things done from the dashboard.
const ACTIONS = [
  { href: "/leads/new", label: "New Lead", icon: UserPlus },
  { href: "/jobs", label: "New Job", icon: ClipboardList },
  { href: "/jobs/dispatch", label: "Dispatch Team", icon: Route },
  { href: "/payments", label: "Record Payment", icon: Wallet },
] as const;

// showPayments=false (Francis/SUPERVISOR, 2026-09-22 policy) drops the
// "Record Payment" tile — it linked straight to the now-blocked /payments
// page, a dead-end/confusing tile for a role that can't open it, not just
// a cosmetic issue.
export function DashboardQuickActions({ showPayments = true }: { showPayments?: boolean }) {
  const actions = ACTIONS.filter((a) => showPayments || a.href !== "/payments");
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
