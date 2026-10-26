import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerImportDialog } from "@/components/customers/customer-import-dialog";
import { CustomersExplorer } from "@/components/customers/customers-explorer";
import { PackageCalculatorButton } from "@/components/layout/package-calculator-dialog";
import { getCustomersPage } from "@/server/customers";
import { requireRole } from "@/lib/current-user";
import { canExportCustomers } from "@/lib/permissions";
import { formatINR } from "@/lib/utils";
import { collectAndPay } from "@/server/vouchers";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  // Full Customers database access (import, export, WhatsApp offer/
  // campaign) is ADMIN/ACCOUNTS only. Francis (Operations) reaches the
  // customer information tied to his own leads/jobs via those pages directly.
  const session = await requireRole(["ADMIN", "ACCOUNTS"]);
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const data = await getCustomersPage({ q, filter: sp.filter, page: Number(sp.page) || 1, pageSize: 25 });
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
            <PackageCalculatorButton variant="button" />
            {canManage && <CustomerImportDialog />}
            {session.role === "ADMIN" && (
              <Button asChild size="sm" variant="outline">
                <Link href="/customers/mybillbook-import">MyBillBook history</Link>
              </Button>
            )}
          </>
        }
      />
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
