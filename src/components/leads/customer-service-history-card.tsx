import Link from "next/link";
import { Download, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomerServiceHistory } from "@/server/customer-service-history";
import { SERVICE_LABELS } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/utils";

/**
 * Lead page → "Past Service History & Invoices": completed jobs for this customer's mobile across all their enquiries,
 * with amounts and invoice downloads. Server component; the lead page renders it only for ADMIN / ACCOUNTS.
 */
export async function CustomerServiceHistoryCard({ mobile }: { mobile: string | null | undefined }) {
  const { rows, totalJobs, totalAmount } = await getCustomerServiceHistory(mobile);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <History className="size-4 text-primary" /> Past Service History &amp; Invoices
        </CardTitle>
        {totalJobs > 0 && (
          <span className="text-xs text-muted-foreground">
            {totalJobs} completed · {formatINR(totalAmount)}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed services for this customer yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.jobId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/jobs/${r.jobId}`} className="font-medium text-foreground hover:underline">
                    {SERVICE_LABELS[r.service] ?? r.service}
                    {r.packageName ? ` · ${r.packageName}` : ""}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {r.jobNumber} · {formatDate(r.date)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{formatINR(r.amount)}</span>
                  {r.invoice ? (
                    <a
                      href={`/api/invoices/${r.invoice.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:border-primary/40"
                      title={`Download invoice ${r.invoice.number}`}
                    >
                      <Download className="size-3.5" /> {r.invoice.number}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">No invoice</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {totalJobs > rows.length && (
          <p className="pt-2 text-xs text-muted-foreground">Showing the latest {rows.length} of {totalJobs}. The full history is on the customer page.</p>
        )}
      </CardContent>
    </Card>
  );
}
