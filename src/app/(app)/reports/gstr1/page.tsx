import Link from "next/link";
import { BarChart3, FileSpreadsheet, LineChart, Megaphone, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { fyLabel, fyOptions } from "@/lib/fy";
import { canAccess } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Finance & Billing → GSTR-1 & Financial Reports (Task 5): the multi-year GSTR-1 working file for the CA, plus the
 * financial dashboards that left the sidebar. Super Admin + Accounts; owner-only dashboards stay owner-only.
 */
export default async function Gstr1Page() {
  const session = await requireRole(["ADMIN", "ACCOUNTS"]);
  // FY 2016-17 onward: room for up to 10 years in one file; MyBillBook history in the CRM starts around FY 21-22.
  const years = fyOptions(new Date(), 2016);
  const current = years[0];
  const fiveBack = years[Math.min(4, years.length - 1)];
  const reports = [
    { href: "/sales", label: "Sales Dashboard", icon: BarChart3, section: "revenue" },
    { href: "/revenue", label: "Revenue Dashboard", icon: Wallet, section: "revenue" },
    { href: "/profit", label: "Profit Dashboard", icon: TrendingUp, section: "profit" },
    { href: "/profit/marketing", label: "Marketing Dashboard", icon: Megaphone, section: "profit" },
    { href: "/reports", label: "Reports", icon: LineChart, section: "reports" },
    { href: "/reports/export-center", label: "Export Center", icon: FileSpreadsheet, section: "reports" },
    { href: "/payments", label: "Payment In", icon: Wallet, section: "payments" },
    { href: "/vouchers/purchase-voucher", label: "Purchase Vouchers", icon: FileSpreadsheet, section: "vouchers" },
    { href: "/vouchers/delivery-challan", label: "Delivery Challan", icon: FileSpreadsheet, section: "vouchers" },
  ].filter((r) => canAccess(session.role, r.section));

  return (
    <div className="space-y-5">
      <PageHeader title="GSTR-1 & Financial Reports" description="CA-ready GSTR-1 working file for any 1–10 financial years, and the financial dashboards." />

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold"><FileSpreadsheet className="size-4 text-primary" /> GSTR-1 Excel (multi-year)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sheets: Summary by Year · b2b · b2cs · hsn (SAC) · docs · Notes — offline-tool columns, filter by Return Period for a month. Intra-state: CGST 9% + SGST 9%.
        </p>
        <form action="/api/export/gstr1" method="get" className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-medium">
            From
            <select name="from" defaultValue={fiveBack} className="mt-1 h-10 w-full rounded-lg border bg-background px-2 text-sm">
              {years.map((y) => <option key={y} value={y}>{fyLabel(y)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">
            To
            <select name="to" defaultValue={current} className="mt-1 h-10 w-full rounded-lg border bg-background px-2 text-sm">
              {years.map((y) => <option key={y} value={y}>{fyLabel(y)}</option>)}
            </select>
          </label>
          <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Download .xlsx</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {[1, 5, 10].map((n) => {
            const from = years[Math.min(n - 1, years.length - 1)];
            return (
              <a key={n} href={`/api/export/gstr1?from=${from}&to=${current}`} className="rounded-full border px-3 py-1 font-semibold hover:bg-muted">
                Last {n} year{n === 1 ? "" : "s"}
              </a>
            );
          })}
        </div>
      </section>

      {reports.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Financial reports</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {reports.map((r) => (
              <Link key={r.href} href={r.href} className="flex min-h-12 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium shadow-sm hover:border-primary/40">
                <r.icon className="size-4 text-primary" /> {r.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
