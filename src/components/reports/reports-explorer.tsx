"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PaymentStatusBadge } from "@/components/shared/status-badge";
import { LogReviewDialog } from "@/components/reports/log-review-dialog";
import { Download, FileText, Star, Loader2 } from "lucide-react";
import { formatINR, formatDate, formatDateTime } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv-export";
import { markReviewReplied } from "@/server/actions/reviews";

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
type Review = {
  id: string;
  customerMobile: string;
  customerName: string | null;
  rating: number;
  comment: string | null;
  createdAt: Date;
  replied: boolean;
  repliedAt: Date | null;
  replyNote: string | null;
};

export function ReportsExplorer({
  jobs,
  photos,
  payments,
  certificates,
  reviews,
  initialTab,
}: {
  jobs: Job[];
  photos: Photo[];
  payments: Payment[];
  certificates: Certificate[];
  reviews: Review[];
  /** Opened from the dashboard "Reviews" link → ?tab=reviews */
  initialTab?: string;
}) {
  const paidPayments = payments.filter((p) => p.status === "PAID");
  const pendingReplyCount = reviews.filter((r) => !r.replied).length;

  return (
    <Tabs defaultValue={["jobs", "photos", "invoices", "paymenthistory", "certificates", "reviews"].includes(initialTab ?? "") ? initialTab : "jobs"}>
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="jobs">Job History</TabsTrigger>
        <TabsTrigger value="photos">Before/After Photos</TabsTrigger>
        <TabsTrigger value="invoices">Invoice History</TabsTrigger>
        <TabsTrigger value="paymenthistory">Payment History</TabsTrigger>
        <TabsTrigger value="certificates">Certificates</TabsTrigger>
        <TabsTrigger value="reviews">
          Reviews{pendingReplyCount > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px]">{pendingReplyCount}</Badge>}
        </TabsTrigger>
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
                <TableHead className="max-sm:hidden">Service</TableHead>
                <TableHead className="max-sm:hidden">Completed</TableHead>
                <TableHead className="max-sm:hidden">Crew</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-sm font-medium">{j.jobNumber}</TableCell>
                  <TableCell className="text-sm">{j.customerName}</TableCell>
                  <TableCell className="text-sm max-sm:hidden">{SERVICE_LABELS[j.service]}</TableCell>
                  <TableCell className="text-sm max-sm:hidden">{j.completedAt ? formatDate(j.completedAt) : "—"}</TableCell>
                  <TableCell className="text-sm max-sm:hidden">{j.assignments.map((a) => a.staff.name).join(", ") || "—"}</TableCell>
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

      <TabsContent value="reviews" className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {reviews.length === 0
              ? "No reviews logged yet."
              : pendingReplyCount > 0
                ? `${pendingReplyCount} review${pendingReplyCount > 1 ? "s" : ""} waiting on a reply.`
                : "All logged reviews have been replied to."}
          </p>
          <LogReviewDialog />
        </div>
        {reviews.length === 0 ? (
          <EmptyState title="No reviews yet" description="Log a review as soon as one lands on Google." />
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`size-3.5 ${i < r.rating ? "fill-amber-400" : "text-muted-foreground"}`} />
                        ))}
                      </span>
                      <p className="text-sm font-medium text-foreground">{r.customerName || r.customerMobile}</p>
                    </div>
                    {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
                    {r.replied && (
                      <p className="mt-1 text-xs text-success">
                        Replied {r.repliedAt ? formatDateTime(r.repliedAt) : ""}
                        {r.replyNote ? ` — ${r.replyNote}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {r.replied ? (
                      <Badge variant="success">Replied</Badge>
                    ) : (
                      <MarkRepliedButton reviewId={r.id} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function MarkRepliedButton({ reviewId }: { reviewId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function markReplied() {
    startTransition(async () => {
      await markReviewReplied(reviewId);
      toast.success("Marked as replied");
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={markReplied} disabled={pending}>
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
      Mark Replied
    </Button>
  );
}
