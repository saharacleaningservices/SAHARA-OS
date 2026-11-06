import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerImportDialog } from "@/components/customers/customer-import-dialog";
import { CustomersExplorer } from "@/components/customers/customers-explorer";
import { getCustomersPage, getSegmentReceivables } from "@/server/customers";
import { requireRole } from "@/lib/current-user";
import { canExportCustomers } from "@/lib/permissions";
import { formatINR, formatLakhs } from "@/lib/utils";
import { collectAndPay } from "@/server/vouchers";
import { ArrowDownLeft, ArrowUpRight, Building2, Home, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string; seg?: string }> }) {
  // Full Customers database access (import, export, WhatsApp offer/
  // campaign) is ADMIN/ACCOUNTS only. Francis (Operations) reaches the
  // customer information tied to his own leads/jobs via those pages directly.
  const session = await requireRole(["ADMIN", "ACCOUNTS"]);
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const [data, recv] = await Promise.all([
    getCustomersPage({ q, filter: sp.filter, page: Number(sp.page) || 1, pageSize: 25, seg: sp.seg }),
    getSegmentReceivables(),
  ]);
  const canManage = canExportCustomers(session.role);
  const money = await collectAndPay();
  // Only what the list shows — site search text never leaves the server.
  const rows = data.rows.map((r) => ({
    mobile: r.mobile, name: r.name, leadCount: r.leadCount, jobCount: r.jobCount, revenue: r.revenue, lastActivity: r.lastActivity,
    area: r.area, outstanding: r.outstanding, contactType: r.contactType, customerNumber: r.customerNumber ?? null, isRepeat: r.isRepeat, siteCount: r.siteCount, variants: r.variants,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Parties"
        description={`${data.allCount} contacts · ${formatINR(data.outstanding)} outstanding`}
        actions={
          <>
            {canManage && <CustomerImportDialog />}
            {session.role === "ADMIN" && (
              <Button asChild size="sm" variant="outline">
                <Link href="/customers/mybillbook-import">MyBillBook history</Link>
              </Button>
            )}
          </>
        }
      />
      {/* Receivables by billing book (MyBillBook sales invoices synced into the CRM, unpaid remaining) */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { key: "B2B", label: "B2B Corporate (GST)", icon: <Building2 className="size-4" />, v: recv.b2b, tone: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300" },
          { key: "B2C", label: "B2C Retail (Non-GST)", icon: <Home className="size-4" />, v: recv.b2c, tone: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300" },
          { key: "ALL", label: "Total Receivables", icon: <Wallet className="size-4" />, v: recv.total, tone: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-300" },
        ].map((c) => (
          <Link key={c.key} href={c.key === "ALL" ? "/customers" : `/customers?seg=${c.key}`} className={`rounded-xl border p-3 transition hover:shadow-md ${c.tone}`}>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">{c.icon} {c.label}</p>
            <p className="text-xl font-bold tabular-nums text-foreground" title={formatINR(c.v.amount)}>{formatLakhs(c.v.amount)}</p>
            <p className="text-xs text-muted-foreground">{c.v.count} unpaid invoice{c.v.count === 1 ? "" : "s"}</p>
          </Link>
        ))}
      </div>

      {/* All | B2B Corporate (GST) | B2C Retail (Non-GST) */}
      <div role="tablist" aria-label="Billing segment" className="inline-flex w-full overflow-hidden rounded-xl border bg-card text-sm font-semibold sm:w-auto">
        {([
          ["ALL", "All", "All"],
          ["B2B", "🏢 B2B Corporate (GST)", "🏢 B2B"],
          ["B2C", "🏠 B2C Retail (Non-GST)", "🏠 B2C"],
        ] as const).map(([key, label, short]) => {
          const qs = new URLSearchParams();
          if (q) qs.set("q", q);
          if (data.filter !== "ALL") qs.set("filter", data.filter);
          if (key !== "ALL") qs.set("seg", key);
          const active = data.seg === key;
          return (
            <Link key={key} role="tab" aria-selected={active} href={`/customers${qs.size ? `?${qs}` : ""}`} className={`flex-1 whitespace-nowrap px-3 py-2 text-center sm:flex-none ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <span className="hidden sm:inline">{label}</span><span className="sm:hidden">{short}</span> <span className="text-xs opacity-75">{data.segCounts[key]}</span>
            </Link>
          );
        })}
      </div>

      {/* To Collect / To Pay (myBillBook style) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/payments?filter=pending" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 transition hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"><ArrowDownLeft className="size-4" /> To Collect</p>
          <p className="text-xl font-bold tabular-nums">{formatINR(money.toCollect)}</p>
          <p className="text-xs text-muted-foreground">{money.toCollectCount} unpaid invoice{money.toCollectCount === 1 ? "" : "s"}</p>
        </Link>
        <Link href="/vouchers/purchase-voucher" className="rounded-xl border border-rose-200 bg-rose-50 p-3 transition hover:shadow-md dark:border-rose-900 dark:bg-rose-950/30">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300"><ArrowUpRight className="size-4" /> To Pay</p>
          <p className="text-xl font-bold tabular-nums">{formatINR(money.toPay)}</p>
          <p className="text-xs text-muted-foreground">{money.toPayCount} unpaid purchase voucher{money.toPayCount === 1 ? "" : "s"}</p>
        </Link>
      </div>
      {/* WhatsApp campaigns (audience / template / sending) are Super Admin only — owner rule 2026-10-06. */}
      <CustomersExplorer
        rows={rows}
        total={data.total}
        counts={data.counts}
        page={data.page}
        totalPages={data.totalPages}
        filter={data.filter}
        q={q}
        canCampaign={session.role === "ADMIN"}
      />
    </div>
  );
}
