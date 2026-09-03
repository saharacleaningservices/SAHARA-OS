"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PaymentStatusBadge } from "@/components/shared/status-badge";
import { Download, FileText } from "lucide-react";
import { formatINR, formatDate } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv-export";

type Job = {
  id: string;
  jobNumber: string;
  customerName: string;
  service: string;
  area: string;
  completedAt: Date | null;
  jobValue: number;
  supervisor?: { name: string } | null;
  assignments: { staff: { name: string } }[];
};
type Photo = { id: string; type: string; url: string; caption: string | null; uploadedAt: Date; job: { jobNumber: string; customerName: string } };
type Payment = { id: string; invoiceNumber: string; clientName: string; amount: number; paidAmount: number; status: string; dueDate: Date; paidDate: Date | null; createdAt: Date };
type Certificate = { id: string; certificateNumber: string; customerName: string; issuedDate: Date; serviceSummary: string };

export function ReportsExplorer({
  jobs,
  photos,
  payments,
  certificates,
}: {
  jobs: Job[];
  photos: Photo[];
  payments: Payment[];
  certificates: Certificate[];
}) {
  const paidPayments = payments.filter((p) => p.status === "PAID");

  return (
    <Tabs defaultValue="jobs">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="jobs">Job History</TabsTrigger>
        <TabsTrigger value="photos">Before/After Photos</TabsTrigger>
        <TabsTrigger value="invoices">Invoice History</TabsTrigger>
        <TabsTrigger value="paymenthistory">Payment History</TabsTrigger>
        <TabsTrigger value="certificates">Certificates</TabsTrigger>
      </TabsList>

      <TabsContent value="jobs" className="space-y-3">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                "job-history.csv",
                jobs.map((j) => ({
                  "Job #": j.jobNumber,
                  Customer: j.customerName,
                  Service: SERVICE_LABELS[j.service],
                  Area: j.area,
                  "Completed On": j.completedAt ? formatDate(j.completedAt) : "",
                  Supervisor: j.supervisor?.name ?? "",
                  Value: j.jobValue,
                }))
              )
            }
          >
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
        {jobs.length === 0 ? (
          <EmptyState title="No completed jobs yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Crew</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-sm font-medium">{j.jobNumber}</TableCell>
                  <TableCell className="text-sm">{j.customerName}</TableCell>
                  <TableCell className="text-sm">{SERVICE_LABELS[j.service]}</TableCell>
                  <TableCell className="text-sm">{j.completedAt ? formatDate(j.completedAt) : "—"}</TableCell>
                  <TableCell className="text-sm">{j.assignments.map((a) => a.staff.name).join(", ") || "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatINR(j.jobValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="photos">
        {photos.length === 0 ? (
          <EmptyState title="No job photos uploaded yet" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <div key={p.id} className="space-y-1.5">
                <img src={p.url} alt={p.caption ?? p.type} className="aspect-square w-full rounded-lg border border-border object-cover" />
                <div className="flex items-center justify-between">
                  <p className="truncate text-xs font-medium text-foreground">{p.job.customerName}</p>
                  <Badge variant={p.type === "BEFORE" ? "muted" : "success"} className="text-[10px]">
                    {p.type}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{p.job.jobNumber} · {formatDate(p.uploadedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="invoices" className="space-y-3">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                "invoice-history.csv",
                payments.map((p) => ({
                  "Invoice #": p.invoiceNumber,
                  Client: p.clientName,
                  Amount: p.amount,
                  Status: p.status,
                  "Due Date": formatDate(p.dueDate),
                }))
              )
            }
          >
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
        {payments.length === 0 ? (
          <EmptyState title="No invoices yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-medium">{p.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">{p.clientName}</TableCell>
                  <TableCell className="text-sm">{formatINR(p.amount)}</TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(p.dueDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="paymenthistory" className="space-y-3">
        {paidPayments.length === 0 ? (
          <EmptyState title="No payments received yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount Paid</TableHead>
                <TableHead>Paid Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paidPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-medium">{p.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">{p.clientName}</TableCell>
                  <TableCell className="text-sm">{formatINR(p.paidAmount)}</TableCell>
                  <TableCell className="text-sm">{p.paidDate ? formatDate(p.paidDate) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="certificates">
        {certificates.length === 0 ? (
          <EmptyState title="No certificates issued yet" />
        ) : (
          <div className="space-y-2">
            {certificates.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.certificateNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.customerName} · {formatDate(c.issuedDate)}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/certificates/${c.id}/pdf`} target="_blank" rel="noreferrer">
                    <FileText className="size-3.5" /> View PDF
                  </a>
                </Button>
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
