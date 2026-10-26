import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/current-user";
import { formatDate, formatINR } from "@/lib/utils";
import { getSalesDashboard } from "@/server/sales-dashboard";
import { BadgeCheck, CopyCheck, HandCoins, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

/** Smaller on phones so ₹13,65,541-size numbers fit a half-width card without wrapping. */
const Amt = ({ n }: { n: number }) => <span className="whitespace-nowrap text-lg sm:text-[1.7rem]">{formatINR(n)}</span>;

// Sales Dashboard (owner 2026-10-25). Layout model: BOX MODEL — four fixed stat cards (2 × 2 on phones, 4 across on
// desktop) so the key numbers never reflow; FLUID inside the cards below — the pending list and the clean-up links
// stretch to the screen width and stack on mobile.
export default async function SalesDashboardPage() {
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const d = await getSalesDashboard();

  return (
    <div className="space-y-4">
      <PageHeader title="Sales Dashboard" description={`Total business, collections and paid invoices — CRM + MyBillBook history, counted once · ${d.fyLabel}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Business (all time)" value={<Amt n={d.totalBusiness.allTime} />} trendLabel={`${d.totalBusiness.invoices} invoices`} icon={<TrendingUp className="size-4" />} tone="primary" />
        <StatCard label={`Business ${d.fyLabel}`} value={<Amt n={d.totalBusiness.fy} />} trendLabel="since 1 April" icon={<TrendingUp className="size-4" />} tone="gold" />
        <StatCard label="Pending Collections" value={<Amt n={d.pending.amount} />} trendLabel={`${d.pending.count} unpaid invoices`} icon={<HandCoins className="size-4" />} tone="warning" href="/payments?filter=pending" />
        <StatCard label="Paid Invoices" value={<Amt n={d.paid.amount} />} trendLabel={`${d.paid.count} invoices fully paid`} icon={<BadgeCheck className="size-4" />} tone="success" href="/invoices" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top 10 pending collections</CardTitle>
          </CardHeader>
          <CardContent>
            {d.topPending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing pending — every invoice is paid.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.topPending.map((p) => (
                  <li key={`${p.source}-${p.number}-${p.party}`}>
                    <Link href={p.href} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2 text-sm hover:bg-accent/50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{p.party}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.number} · {formatDate(p.date)} · {p.source} · bill {formatINR(p.total)}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums text-amber-600">{formatINR(p.balance)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CopyCheck className="size-4" /> Profile de-duplication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/customers?filter=DUPLICATES" className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent/50">
              <span>Possible duplicate profiles<span className="block text-xs text-muted-foreground">Same mobile, different spellings — review and merge</span></span>
              <span className="text-lg font-bold tabular-nums">{d.dedup.possibleDuplicates}</span>
            </Link>
            <Link href="/customers/mybillbook-import" className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent/50">
              <span>MyBillBook invoices needing a choice<span className="block text-xs text-muted-foreground">Two profiles match — pick one, never duplicated</span></span>
              <span className="text-lg font-bold tabular-nums">{d.dedup.mbbNeedChoice}</span>
            </Link>
            <Link href="/customers/mybillbook-import?show=unmatched" className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent/50">
              <span>MyBillBook invoices with no customer<span className="block text-xs text-muted-foreground">Add the mobile — it attaches to the existing profile</span></span>
              <span className="text-lg font-bold tabular-nums">{d.dedup.mbbNoCustomer}</span>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
