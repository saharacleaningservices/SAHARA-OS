import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { getCustomersList } from "@/server/customers";
import { formatINR, formatDate } from "@/lib/utils";

export default async function CustomersPage() {
  const customers = await getCustomersList();

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description={`${customers.length} customers · lifetime history`} />
      {customers.length === 0 ? (
        <EmptyState title="No customers yet" description="Customers appear here once you have leads or jobs." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Jobs</TableHead>
              <TableHead>Lifetime Value</TableHead>
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
                </TableCell>
                <TableCell className="text-sm">{c.mobile}</TableCell>
                <TableCell className="text-sm">{c.leadCount}</TableCell>
                <TableCell className="text-sm">{c.jobCount}</TableCell>
                <TableCell className="text-sm font-medium">{formatINR(c.revenue)}</TableCell>
                <TableCell className="text-sm">{formatDate(c.lastActivity)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
