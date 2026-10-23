import { ExternalLink, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatINR } from "@/lib/utils";
import type { InvoiceDetail } from "@/lib/mybillbook-detail";

export type MybillbookHistoryRow = {
  invoiceKey: string;
  invoiceNo: string;
  invoiceDate: Date;
  amount: number;
  remaining: number;
  status: string;
  invoiceLink: string;
  serviceName: string | null;
  jobNumber: string | null;
  partyAddress?: string | null;
  detail?: InvoiceDetail | null;
};

/** Past MyBillBook invoices attached to this customer (service lines read from the invoice link). Money — Admin / Accounts only. */
export function MybillbookHistoryCard({ rows }: { rows: MybillbookHistoryRow[] }) {
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const due = rows.reduce((s, r) => s + r.remaining, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5">
            <Receipt className="size-4" /> MyBillBook invoice history ({rows.length})
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            Billed {formatINR(total)}
            {due > 0 ? ` · balance ${formatINR(due)}` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.invoiceKey} className="rounded-lg border p-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="font-semibold">{r.invoiceNo}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  {formatDate(r.invoiceDate)}
                  {r.serviceName ? ` · ${r.serviceName}` : ""}
                  {r.jobNumber ? " · CRM job" : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{formatINR(r.amount)}</span>
                <span className={`rounded-full px-2 text-[10px] font-semibold ${r.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                  {r.status === "Paid" ? "Paid" : `Due ${formatINR(r.remaining)}`}
                </span>
                <a href={r.invoiceLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline" aria-label={`Open MyBillBook invoice ${r.invoiceNo}`}>
                  Open <ExternalLink className="size-3" />
                </a>
              </span>
            </div>
            {r.detail && r.detail.lines.length > 0 && (
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Service details</summary>
                <ul className="mt-1 space-y-0.5">
                  {r.detail.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{l.name}{l.qty > 1 ? ` × ${l.qty}` : ""}</span>
                      <span className="tabular-nums">{formatINR(l.amount)}</span>
                    </li>
                  ))}
                </ul>
                {(r.detail.gstAmount ?? 0) > 0 && <p className="mt-1">GST {formatINR(r.detail.gstAmount)} (taxable {formatINR(r.detail.taxableAmount)}){r.detail.partyGstin ? ` · GSTIN ${r.detail.partyGstin}` : ""}</p>}
                {r.detail.notes && <p className="mt-1 whitespace-pre-line text-muted-foreground">{r.detail.notes}</p>}
                {r.partyAddress && <p className="mt-1 text-muted-foreground">Address: {r.partyAddress}</p>}
              </details>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
