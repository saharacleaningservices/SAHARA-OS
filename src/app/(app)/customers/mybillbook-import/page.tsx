import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";
import { formatDate, formatINR } from "@/lib/utils";
import { MybillbookReviewActions, MybillbookUpload } from "@/components/customers/mybillbook-import-panel";

// MyBillBook invoice history import + review list (owner 2026-10-23). Super Admin only. The report carries no phone numbers, so a row is
// attached to a customer only on a safe match; everything else is listed here for a decision.
export const dynamic = "force-dynamic";
const PAGE = 100;

export default async function MybillbookImportPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireRole(["ADMIN"]);
  const { show } = await searchParams;
  const view = show === "unmatched" ? "UNMATCHED" : "REVIEW";
  const [total, matched, review, unmatched, rows] = await Promise.all([
    db.mybillbookInvoice.count(),
    db.mybillbookInvoice.count({ where: { matchStatus: { in: ["MATCHED", "MANUAL"] } } }),
    db.mybillbookInvoice.count({ where: { matchStatus: "REVIEW" } }),
    db.mybillbookInvoice.count({ where: { matchStatus: "UNMATCHED" } }),
    db.mybillbookInvoice.findMany({ where: { matchStatus: view }, orderBy: { invoiceDate: "desc" }, take: PAGE }),
  ]);
  const candidateIds = [...new Set(rows.flatMap((r) => (r.candidateIds ? (JSON.parse(r.candidateIds) as string[]) : [])))];
  const candidates = candidateIds.length ? await db.customer.findMany({ where: { id: { in: candidateIds } }, select: { id: true, name: true, mobile: true } }) : [];
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const tab = (key: string, label: string, n: number) => (
    <Link
      href={key === "REVIEW" ? "/customers/mybillbook-import" : `/customers/mybillbook-import?show=${key.toLowerCase()}`}
      className={`rounded-full border px-3 py-1 text-sm font-semibold ${view === key ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
    >
      {label} ({n})
    </Link>
  );
  return (
    <div className="space-y-4">
      <PageHeader title="MyBillBook history import" description="Attach past MyBillBook invoices to customer profiles. The report has no phone numbers, so only an exact full-name match (or a CRM invoice number) is attached automatically." />
      <MybillbookUpload />
      <p className="text-sm text-muted-foreground">
        {total} invoices stored · {matched} attached to customers · {review} need a choice · {unmatched} have no customer yet
      </p>
      <div className="flex gap-2">
        {tab("REVIEW", "Need a choice", review)}
        {tab("UNMATCHED", "No customer found", unmatched)}
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2">Invoice</th>
              <th className="p-2">Date</th>
              <th className="p-2">Name on invoice</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-right">Balance</th>
              <th className="p-2">Attach to</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">Nothing waiting here.</td>
              </tr>
            )}
            {rows.map((r) => {
              const cands = (r.candidateIds ? (JSON.parse(r.candidateIds) as string[]) : []).map((id) => byId.get(id)).filter(Boolean) as { id: string; name: string; mobile: string }[];
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2">
                    <a href={r.invoiceLink} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">{r.invoiceNo}</a>
                  </td>
                  <td className="whitespace-nowrap p-2">{formatDate(r.invoiceDate)}</td>
                  <td className="p-2">{r.contactName}</td>
                  <td className="p-2 text-right tabular-nums">{formatINR(r.amount)}</td>
                  <td className="p-2 text-right tabular-nums">{r.remaining > 0 ? formatINR(r.remaining) : "—"}</td>
                  <td className="p-2">
                    <MybillbookReviewActions invoiceKey={r.invoiceKey} candidates={cands} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(view === "REVIEW" ? review : unmatched) > PAGE && <p className="text-xs text-muted-foreground">Showing the newest {PAGE}. Resolve some and the next ones appear.</p>}
    </div>
  );
}
