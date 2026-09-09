import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { CustomerImportDialog } from "@/components/customers/customer-import-dialog";
import { getCustomersList } from "@/server/customers";
import { requireRole } from "@/lib/current-user";
import { formatINR, formatDate } from "@/lib/utils";

export default async function CustomersPage() {
  const session = await requireRole(["ADMIN", "OPERATIONS", "ACCOUNTS"]);
  const customers = await getCustomersList();
  const canImport = session.role === "ADMIN" || session.role === "OPERATIONS";
  const outstanding = customers.reduce((s, c) => s + (c.outstanding ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${customers.length} customers · ${formatINR(outstanding)} outstanding`}
        actions={canImport ? <CustomerImportDialog /> : null}
      />
      {customers.length === 0 ? (
        <EmptyState title="No customers yet" description="Customers appear here once you have leads or jobs." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Area</TableHead>
              <TableHead className="text-center">Leads</TableHead>
              <TableHead className="text-center">Jobs</TableHead>
              <TableHead className="text-right">Lifetime Value</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.mobile}>
                <TableCell>
                  <Link href={`/customers/${c.mobile}`} className="font-medium text-foreground hover:underline">
                    {c.name || "Unknown"}
                  </Link>
                  {c.imported && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Imported</span>}
                </TableCell>
                <TableCell className="text-sm">{c.mobile}</TableCell>
                <TableCell className="text-sm">{c.area ?? "—"}</TableCell>
                <TableCell className="text-center text-sm">{c.leadCount}</TableCell>
                <TableCell className="text-center text-sm">{c.jobCount}</TableCell>
                <TableCell className="text-right text-sm font-medium">{formatINR(c.revenue)}</TableCell>
                <TableCell className={`text-right text-sm ${(c.outstanding ?? 0) > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                  {(c.outstanding ?? 0) > 0 ? formatINR(c.outstanding) : "—"}
                </TableCell>
                <TableCell className="text-sm">{formatDate(c.lastActivity)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
