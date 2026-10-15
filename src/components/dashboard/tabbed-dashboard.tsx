"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Inbox, Truck, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tabbed home dashboard (ADMIN / OPERATIONS / ACCOUNTS), same layout at every width.
 * Sits inside AppShell, so the Topbar already carries the logo; the tab bar sticks under it.
 *
 * Data stays server-side: /dashboard builds each tab's nodes once and passes them in.
 * A role's disallowed tabs are never rendered AND the page never builds them for that
 * role — Finance is ADMIN/ACCOUNTS only, Francis (OPERATIONS) gets no money data at all.
 * Only the active tab is mounted, so client widgets in other tabs don't fetch until opened.
 */
export type DashboardRole = "ADMIN" | "OPERATIONS" | "ACCOUNTS";
export type TabKey = "inquiries" | "operations" | "finance";
export const TAB_KEYS: readonly TabKey[] = ["inquiries", "operations", "finance"];

const TABS: { key: TabKey; label: string; short: string; icon: typeof Inbox; roles: DashboardRole[] }[] = [
  { key: "inquiries", label: "Quick Add & Inquiries", short: "Inquiries", icon: Inbox, roles: ["ADMIN", "OPERATIONS", "ACCOUNTS"] },
  { key: "operations", label: "Operations & Dispatch", short: "Operations", icon: Truck, roles: ["ADMIN", "OPERATIONS", "ACCOUNTS"] },
  { key: "finance", label: "Finance & Accounts", short: "Finance", icon: Wallet, roles: ["ADMIN", "ACCOUNTS"] },
];

const DEFAULT_TAB: Record<DashboardRole, TabKey> = { ADMIN: "inquiries", OPERATIONS: "operations", ACCOUNTS: "finance" };

export function TabbedDashboard({
  role,
  hero,
  inquiries,
  operations,
  finance,
}: {
  role: DashboardRole;
  hero?: ReactNode;
  inquiries: ReactNode;
  operations: ReactNode;
  finance?: ReactNode;
}) {
  const content: Record<TabKey, ReactNode> = { inquiries, operations, finance };
  const visible = TABS.filter((t) => t.roles.includes(role) && content[t.key] != null);
  const allowed = (k: string | null | undefined): k is TabKey => visible.some((t) => t.key === k);
  const fallback = allowed(DEFAULT_TAB[role]) ? DEFAULT_TAB[role] : visible[0]?.key;

  // The URL is the only tab state: ?tab= missing or not allowed for this role → role default.
  // Read live (not a server prop) so Back to a cached /dashboard?tab=… shows the right tab.
  const fromUrl = useSearchParams().get("tab");
  const active = allowed(fromUrl) ? fromUrl : fallback;

  // replaceState (Next syncs it into useSearchParams): no server round-trip, no extra history entry.
  // State must be null — Next ignores calls carrying its own internal history state.
  function select(key: TabKey) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="space-y-4">
      {hero}

      <div
        role="tablist"
        aria-label="Dashboard sections"
        className="sticky top-16 z-20 -mx-4 flex gap-1 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
      >
        {visible.map(({ key, label, short, icon: Icon }) => {
          const on = active === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={on}
              aria-controls={`panel-${key}`}
              onClick={() => select(key)}
              className={cn(
                "flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold transition-colors sm:flex-none sm:px-4 sm:text-sm",
                on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate sm:hidden">{short}</span>
              <span className="hidden truncate sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {active && (
        <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="space-y-4">
          {content[active]}
        </div>
      )}
    </div>
  );
}

/* ---------- building blocks for the tab panels ---------- */

/** One tappable list row: name on the left, detail/pill on the right. */
export function ListRow({ href, left, right }: { href?: string; left: ReactNode; right?: ReactNode }) {
  const body = (
    <>
      <span className="min-w-0 truncate text-sm text-foreground">{left}</span>
      {right != null && <span className="shrink-0 text-xs text-muted-foreground">{right}</span>}
    </>
  );
  const cls = "flex min-h-11 items-center justify-between gap-2 px-4 py-2";
  return href ? (
    <Link href={href} className={cn(cls, "hover:bg-muted/60")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Card that shows the first `preview` rows and a "View all" toggle that expands in place.
 * `href` adds a link to the full page list (for lists the server caps).
 */
export function CollapsibleList({
  title,
  icon,
  items,
  count,
  preview = 3,
  href,
  empty = "Nothing pending",
}: {
  title: ReactNode;
  icon?: ReactNode;
  items: ReactNode[];
  count?: number;
  preview?: number;
  href?: string;
  empty?: ReactNode;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, preview);
  const total = count ?? items.length;
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
        <span className="flex shrink-0 items-center gap-2">
          {href && (
            <Link href={href} className="text-xs font-medium text-primary">
              Open →
            </Link>
          )}
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", total > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{total}</span>
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {shown.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
      {items.length > preview && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="flex min-h-11 w-full items-center justify-center gap-1 border-t border-border text-sm font-semibold text-primary"
        >
          {all ? "Show less" : `View all (${items.length})`}
          <ChevronDown className={cn("size-4 transition-transform", all && "rotate-180")} />
        </button>
      )}
    </section>
  );
}
