import { ExternalLink, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatINR } from "@/lib/utils";

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
};

/** Past MyBillBook invoices attached to this customer (service shown when known; details are added later). Money — Admin / Accounts only. */
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
          <div key={r.invoiceKey} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm">
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
        ))}
      </CardContent>
    </Card>
  );
}
