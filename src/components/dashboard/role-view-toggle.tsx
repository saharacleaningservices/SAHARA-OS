import Link from "next/link";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardView = "all" | "finance" | "operations";

/** Read the ADMIN-only "view as" choice. Any other role always gets its own dashboard (the parameter is ignored). */
export function dashboardViewFor(role: string, as: string | undefined): DashboardView {
  if (role !== "ADMIN") return "all";
  return as === "finance" || as === "operations" ? as : "all";
}

const VIEWS: { key: DashboardView; label: string; who: string }[] = [
  { key: "all", label: "Full view", who: "Owner" },
  { key: "finance", label: "Finance view", who: "Shoyab" },
  { key: "operations", label: "Operations view", who: "Francis" },
];

/**
 * Super Admin role toggle (owner 2026-10-22): preview exactly what Finance (Accounts) or Operations sees on their home
 * dashboard. The page builds the previewed role's sections server-side, so Operations view carries no money data.
 * Actions on the page still run as the Super Admin.
 */
export function RoleViewToggle({ view }: { view: DashboardView }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Eye className="size-3.5" /> View as</span>
      {VIEWS.map((v) => (
        <Link
          key={v.key}
          href={v.key === "all" ? "/dashboard" : `/dashboard?as=${v.key}`}
          aria-current={view === v.key ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            view === v.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
          )}
        >
          {v.label} <span className="font-normal opacity-80">· {v.who}</span>
        </Link>
      ))}
      {view !== "all" && <span className="w-full text-[11px] text-muted-foreground sm:w-auto">Preview of their dashboard. You are still signed in as Super Admin.</span>}
    </div>
  );
}
