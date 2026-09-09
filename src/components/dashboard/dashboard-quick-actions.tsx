import Link from "next/link";
import { ClipboardList, CalendarClock, CalendarRange, Route } from "lucide-react";

// Master Prompt v2.0 Phase 3 — Quick Call and Quick Capture removed.
// The dashboard now leads with the four day-to-day operations views.
const ACTIONS = [
  { href: "/jobs?when=today", label: "Today's Jobs", icon: ClipboardList },
  { href: "/jobs?when=tomorrow", label: "Tomorrow's Jobs", icon: CalendarClock },
  { href: "/jobs", label: "Monthly Jobs", icon: CalendarRange },
  { href: "/jobs/dispatch", label: "Team Dispatch", icon: Route },
] as const;

export function DashboardQuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ACTIONS.map(({ href, label, icon: Icon }) => (
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
