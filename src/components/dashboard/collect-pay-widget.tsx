import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, FileText, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { collectAndPay, latestTransactions } from "@/server/vouchers";
import { formatDate, formatINR } from "@/lib/utils";

/**
 * MyBillBook-style money strip for the Finance dashboard (Super Admin + Accounts only — the caller decides): To Collect, To Pay,
 * quick create buttons (large touch targets) and the latest transactions.
 */
export async function CollectPayWidget() {
  const [m, latest] = await Promise.all([collectAndPay(), latestTransactions(8)]);
  const quick = [
    { href: "/invoices", label: "Create Sales Invoice", primary: true },
    { href: "/quotations", label: "Quotation / Estimate" },
    { href: "/payments", label: "Payment In" },
    { href: "/vouchers/purchase-voucher", label: "Purchase Voucher" },
  ];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/payments?filter=pending" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 transition hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"><ArrowDownLeft className="size-4" /> To Collect</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatINR(m.toCollect)}</p>
          <p className="text-xs text-muted-foreground">{m.toCollectCount} unpaid invoice{m.toCollectCount === 1 ? "" : "s"}{m.creditNoteCount > 0 ? ` · ${m.creditNoteCount} credit note${m.creditNoteCount === 1 ? "" : "s"} (${formatINR(m.creditNotes)}) issued, not netted` : ""}</p>
        </Link>
        <Link href="/vouchers/purchase-voucher" className="rounded-xl border border-rose-200 bg-rose-50 p-4 transition hover:shadow-md dark:border-rose-900 dark:bg-rose-950/30">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300"><ArrowUpRight className="size-4" /> To Pay</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatINR(m.toPay)}</p>
          <p className="text-xs text-muted-foreground">{m.toPayCount} unpaid purchase voucher{m.toPayCount === 1 ? "" : "s"}</p>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {quick.map((q) => (
          <Link key={q.label} href={q.href} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-center text-sm font-semibold transition hover:-translate-y-0.5 ${q.primary ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
            <Plus className="size-4 shrink-0" /> {q.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-sm"><FileText className="size-4" /> Latest Transactions</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {latest.length === 0 && <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>}
          {latest.map((t, i) => (
            <div key={i} className="flex items-center justify-between gap-2 border-b py-1.5 text-sm last:border-0">
              <span className="min-w-0">
                <span className="font-medium">{t.kind}</span> <span className="text-xs text-muted-foreground">{t.label} · {t.party} · {formatDate(t.at)}</span>
              </span>
              <span className={`shrink-0 tabular-nums font-semibold ${t.direction === "in" ? "text-emerald-600" : t.direction === "out" ? "text-rose-600" : ""}`}>{t.direction === "out" ? "−" : t.direction === "in" ? "+" : ""}{formatINR(t.amount)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
