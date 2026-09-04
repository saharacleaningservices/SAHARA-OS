import { notFound } from "next/navigation";
import Link from "next/link";
import { Star, MessageSquare, ClipboardList, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { LeadStageBadge, JobStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { getCustomerHistory } from "@/server/customers";
import { formatINR, formatDate, formatDateTime } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";

export default async function CustomerDetailPage({ params }: { params: Promise<{ mobile: string }> }) {
  const { mobile } = await params;
  const { leads, jobs, payments, reviews } = await getCustomerHistory(mobile);
  if (leads.length === 0 && jobs.length === 0 && payments.length === 0) notFound();

  const name = leads[0]?.name || jobs[0]?.customerName || "Customer";
  const totalRevenue = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.paidAmount, 0);
  const allPhotos = jobs.flatMap((j) => j.photos);

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        description={`${mobile} · ${leads.length} enquiries · ${jobs.length} jobs · LTV ${formatINR(totalRevenue)}`}
        actions={
          <>
            <CallButton mobile={mobile} />
            <WhatsAppButton mobile={mobile} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-4" /> Enquiries
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leads.length === 0 ? (
                <EmptyState title="No enquiries" />
              ) : (
                <div className="space-y-3">
                  {leads.map((lead) => (
                    <div key={lead.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:underline">
                          {lead.leadNumber} · {SERVICE_LABELS[lead.service]}
                        </Link>
                        <LeadStageBadge stage={lead.stage} />
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(lead.createdAt)} · {lead.area}</p>
                      {lead.timeline.length > 0 && (
                        <div className="mt-2 space-y-1 border-l border-border pl-3">
                          {lead.timeline.slice(-5).map((t) => (
                            <p key={t.id} className="text-xs text-muted-foreground">
                              {formatDateTime(t.createdAt)} — {t.body ?? t.type}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4" /> Jobs & Photos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {jobs.length === 0 ? (
                <EmptyState title="No jobs yet" />
              ) : (
                jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/40"
                  >
                    <div>
                      <p className="font-medium text-foreground">{job.jobNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(job.scheduledDate)} · {formatINR(job.jobValue)}
                      </p>
                    </div>
                    <JobStatusBadge status={job.status} />
                  </Link>
                ))
              )}
              {allPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-2 sm:grid-cols-4">
                  {allPhotos.slice(0, 8).map((p) => (
                    <img key={p.id} src={p.url} alt={p.caption ?? p.type} className="aspect-square w-full rounded-lg border border-border object-cover" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4" /> Payments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {payments.length === 0 ? (
                <EmptyState title="No payments" />
              ) : (
                payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">Due {formatDate(p.dueDate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{formatINR(p.amount)}</span>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="size-4" /> Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews collected yet.</p>
              ) : (
                <div className="space-y-2">
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border p-2.5">
                      <p className="text-sm font-medium text-foreground">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>
                      {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
