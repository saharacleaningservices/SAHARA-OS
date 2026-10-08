import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, CalendarPlus, ChevronDown, Megaphone, MessageCircle, Star, UserPlus } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav-config";
import { PackageCalculatorButton } from "@/components/layout/package-calculator-dialog";
import { canAccess } from "@/lib/constants";

// Dashboard control center — the six owner-defined groups, each holding only its
// own modules (owner spec 2026-10-08). Built from NAV_ITEMS + canAccess, so a role
// sees only modules it can open (same rule as the sidebar; pages and server
// actions re-check). Everything else stays in the sidebar.
type Item = { href: string; label: string; icon?: LucideIcon; section?: string } | "calculator";
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Operations", items: [{ href: "/leads", label: "Leads" }, { href: "/jobs", label: "Jobs" }, { href: "/jobs/dispatch", label: "Team Dispatch" }, { href: "/jobs/slots", label: "Slot Availability" }] },
  {
    title: "Customers & Sales",
    items: [{ href: "/customers", label: "Customers" }, "calculator", { href: "/quotations", label: "Quotations" }, { href: "/invoices", label: "Invoices" }, { href: "/reports?tab=reviews", label: "Reviews", icon: Star, section: "reports" }],
  },
  {
    title: "Services",
    items: [
      { href: "/jobs?service=HOUSEKEEPING", label: "Housekeeping" },
      { href: "/jobs?service=PEST_CONTROL", label: "Pest Control" },
      { href: "/jobs?service=INTERIOR_PAINTING", label: "Interior Painting" },
    ],
  },
  {
    title: "Finance",
    items: [{ href: "/expenses", label: "Expenses" }, { href: "/payments", label: "Payments" }, { href: "/profit", label: "Profit Dashboard" }, { href: "/admin/khata-import", label: "Khata Book" }],
  },
  {
    title: "Marketing",
    items: [
      { href: "/admin/whatsapp-inbox", label: "WhatsApp Customer Alerts", icon: MessageCircle },
      // Marketing campaigns live on Customers (Super Admin only, opt-in audiences).
      { href: "/customers", label: "Marketing Customer Alerts", icon: Megaphone, section: "profit" },
      { href: "/admin/whatsapp-log", label: "Message Logs" },
      { href: "/profit/marketing", label: "Marketing Dashboard" },
    ],
  },
  {
    title: "Admin & Tools",
    items: [
      { href: "/settings/pricing", label: "Pricing & Packages" },
      { href: "/reports/export-center", label: "Export Center" },
      { href: "/admin/announcements", label: "Announcements" },
      { href: "/assistant", label: "AI Assistant" },
      { href: "/admin/gallery", label: "Gallery" },
      { href: "/admin/trash", label: "Trash" },
    ],
  },
];

const chip = "flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40";

export function DashboardModules({ role }: { role: string }) {
  const byHref = new Map(NAV_ITEMS.map((n) => [n.href, n]));
  const groups = GROUPS.map((g) => ({
    title: g.title,
    items: g.items.flatMap((it): ("calculator" | { href: string; label: string; Icon?: LucideIcon })[] => {
      if (it === "calculator") return [it];
      const nav = byHref.get(it.href);
      const section = it.section ?? nav?.section;
      if (!section || !canAccess(role, section)) return [];
      return [{ href: it.href, label: it.label, Icon: it.icon ?? nav?.icon }];
    }),
  })).filter((g) => g.items.some((i) => i !== "calculator"));

  const links = (items: (typeof groups)[number]["items"]) =>
    items.map((it) =>
      it === "calculator" ? (
        <PackageCalculatorButton key="calc" />
      ) : (
        <Link key={it.href + it.label} href={it.href} className={chip}>
          {it.Icon && <it.Icon className="size-3.5 text-primary" />} {it.label}
        </Link>
      ),
    );

  // Six compact group tiles (phone 2 columns, desktop 3) — a group's modules show only when it is opened.
  return (
    <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-3">
      {groups.map((g) => (
        <details key={g.title} className="group rounded-xl border bg-card open:col-span-2 sm:open:col-span-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-1 px-3 py-2.5 text-sm font-semibold">
            <span className="min-w-0 truncate">{g.title}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-wrap gap-1.5 px-3 pb-3">{links(g.items)}</div>
        </details>
      ))}
    </div>
  );
}

/** New Lead · New Job · Package Calculator · Schedule. New Job = a lead that opens on Confirm Booking (one intake). */
export function DashboardQuickBar({ role }: { role: string }) {
  if (!canAccess(role, "leads")) return null;
  const btn = "flex items-center justify-center gap-1.5 rounded-xl border bg-card px-2 py-2.5 text-xs font-semibold hover:border-primary/40";
  return (
    <div className="grid grid-cols-4 gap-2">
      <Link href="/leads/new" className={btn}>
        <UserPlus className="size-4 text-primary" /> <span className="max-sm:sr-only">New</span> Lead
      </Link>
      <Link href="/leads/new?book=1" className={btn}>
        <CalendarPlus className="size-4 text-primary" /> <span className="max-sm:sr-only">New</span> Job
      </Link>
      <div className="[&>button]:h-full [&>button]:w-full [&>button]:justify-center [&>button]:rounded-xl [&>button]:bg-card [&>button]:px-2 [&>button]:text-xs [&>button]:font-semibold">
        <PackageCalculatorButton label="Calculator" />
      </div>
      <a href="#schedule" className={btn}>
        <CalendarDays className="size-4 text-primary" /> Schedule
      </a>
    </div>
  );
}
