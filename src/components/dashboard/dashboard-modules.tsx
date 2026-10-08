import Link from "next/link";
import { NAV_ITEMS } from "@/components/layout/nav-config";
import { PackageCalculatorButton } from "@/components/layout/package-calculator-dialog";
import { canAccess } from "@/lib/constants";

// Dashboard module launcher — every page grouped by job-to-be-done. Built from
// NAV_ITEMS + canAccess, so a role only ever sees the modules it can open
// (same rule as the sidebar; page loads and server actions re-check).
const GROUPS: { title: string; hrefs: string[]; calculator?: boolean }[] = [
  { title: "Operations", hrefs: ["/leads", "/jobs", "/jobs/dispatch", "/jobs/slots", "/staff", "/attendance", "/vehicles", "/amc"] },
  { title: "Customers & Sales", hrefs: ["/customers", "/leads/price-list", "/quotations", "/invoices", "/reports"], calculator: true },
  { title: "Services", hrefs: ["/jobs?service=HOUSEKEEPING", "/jobs?service=PEST_CONTROL", "/jobs?service=INTERIOR_PAINTING"] },
  { title: "Finance", hrefs: ["/payments", "/expenses", "/revenue", "/profit", "/admin/khata-import"] },
  { title: "Marketing", hrefs: ["/profit/marketing", "/admin/announcements", "/admin/whatsapp-inbox", "/admin/whatsapp-log"] },
  {
    title: "Admin & Tools",
    hrefs: ["/settings/pricing", "/reports/export-center", "/assistant", "/admin/gallery", "/admin/trash", "/admin/audit-log", "/admin/users", "/admin/device-approvals", "/admin/security-approvals"],
  },
];

const PRIMARY = ["/leads", "/jobs", "/jobs/dispatch", "/jobs/slots", "/customers", "/payments"];

const SHORT: Record<string, string> = {
  "Leads / CRM": "Leads",
  "Revenue Dashboard": "Revenue",
  "Profit Dashboard": "Profit",
  "Marketing Dashboard": "Marketing",
  "Khata Book Import": "Khata",
  "Pricing & Packages": "Pricing",
  "AMC Contracts": "AMC",
};

export function DashboardModules({ role }: { role: string }) {
  const byHref = new Map(NAV_ITEMS.map((n) => [n.href, n]));
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.hrefs.map((h) => byHref.get(h)).filter((n): n is NonNullable<typeof n> => !!n && canAccess(role, n.section)),
  })).filter((g) => g.items.length > 0 || g.calculator);

  const chip = "flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40";
  const grid = (
    <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <section key={g.title} className="min-w-0">
          <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h2>
          <div className="flex flex-wrap gap-1.5">
            {g.calculator && <PackageCalculatorButton />}
            {g.items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={chip}>
                <Icon className="size-3.5 text-primary" /> {SHORT[label] ?? label}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
  // Phone: the day-to-day shortcuts stay one tap away; everything else folds away.
  const primary = PRIMARY.map((h) => byHref.get(h)).filter((n): n is NonNullable<typeof n> => !!n && canAccess(role, n.section));
  const total = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <>
      <div className="space-y-2 sm:hidden">
        <div className="flex flex-wrap gap-1.5">
          {primary.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={chip}>
              <Icon className="size-3.5 text-primary" /> {SHORT[label] ?? label}
            </Link>
          ))}
          <PackageCalculatorButton />
        </div>
        <details className="group rounded-xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-semibold">
            All modules <span className="text-xs font-normal text-muted-foreground">{total} · tap to open</span>
          </summary>
          <div className="px-3 pb-3">{grid}</div>
        </details>
      </div>
      <div className="rounded-xl border bg-card p-4 max-sm:hidden">{grid}</div>
    </>
  );
}
