import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { typeFromSlug, VOUCHER_META } from "@/lib/vouchers";
import { listVouchers } from "@/server/vouchers";
import { NewVoucherDialog } from "@/components/vouchers/voucher-form";
import { VoucherRowActions } from "@/components/vouchers/voucher-row-actions";
import { formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Proforma Invoice / Credit Note / Delivery Challan / Purchase Voucher lists (owner 2026-10-23). Super Admin + Accounts only.
export default async function VoucherListPage({ params }: { params: Promise<{ type: string }> }) {
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const type = typeFromSlug((await params).type);
  if (!type) notFound();
  const meta = VOUCHER_META[type];
  const rows = await listVouchers(type);
  return (
    <div className="space-y-4">
      <PageHeader title={meta.plural} description={type === "PURCHASE" ? "What Sahara buys from vendors; unpaid balances show as To Pay on the dashboard." : type === "DELIVERY_CHALLAN" ? "Goods / service delivered to a party, quantities only." : type === "CREDIT_NOTE" ? "A credit given to a party against an invoice." : "An advance bill sent before the final invoice."} actions={<NewVoucherDialog type={type} />} />
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2">Number</th>
              <th className="p-2">Date</th>
              <th className="p-2">{type === "PURCHASE" ? "Vendor" : "Party"}</th>
              {meta.hasMoney && <th className="p-2">GST</th>}
              {meta.hasMoney && <th className="p-2 text-right">Total</th>}
              {type === "PURCHASE" && <th className="p-2 text-right">To pay</th>}
              <th className="p-2">Status</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No {meta.plural.toLowerCase()} yet.</td></tr>
            )}
            {rows.map((v) => {
              const owed = Math.max(0, Math.round((v.totalAmount - v.paidAmount) * 100) / 100);
              return (
                <tr key={v.id} className={`border-t ${v.status === "CANCELLED" ? "opacity-50" : ""}`}>
                  <td className="p-2 font-semibold">{v.number}{v.refNumber ? <span className="block text-xs font-normal text-muted-foreground">Ref {v.refNumber}</span> : null}</td>
                  <td className="whitespace-nowrap p-2">{formatDate(v.voucherDate)}</td>
                  <td className="p-2">{v.partyName}{v.partyMobile ? <span className="block text-xs text-muted-foreground">{v.partyMobile}</span> : null}</td>
                  {meta.hasMoney && <td className="p-2 text-xs">{v.isGst ? `GST ${v.gstPercent}%` : "Non-GST"}</td>}
                  {meta.hasMoney && <td className="p-2 text-right tabular-nums">{formatINR(v.totalAmount)}</td>}
                  {type === "PURCHASE" && <td className="p-2 text-right tabular-nums">{v.status === "CANCELLED" ? "—" : formatINR(owed)}</td>}
                  <td className="p-2 text-xs">{v.status}</td>
                  <td className="p-2"><VoucherRowActions id={v.id} isPurchase={type === "PURCHASE"} owed={owed} cancelled={v.status === "CANCELLED"} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
