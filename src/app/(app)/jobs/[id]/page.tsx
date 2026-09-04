import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Users, Pencil } from "lucide-react";
import { getJobDetail } from "@/server/jobs";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { StatusActions } from "@/components/jobs/status-actions";
import { PhotoUploader } from "@/components/jobs/photo-uploader";
import { SignatureCapture } from "@/components/jobs/signature-capture";
import { EmptyState } from "@/components/shared/empty-state";
import { formatINR, formatDate, formatDateTime } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJobDetail(id);
  if (!job) notFound();

  const beforePhotos = job.photos.filter((p) => p.type === "BEFORE");
  const afterPhotos = job.photos.filter((p) => p.type === "AFTER");

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.customerName}
        description={`${job.jobNumber} · ${SERVICE_LABELS[job.service]} · ${job.area}`}
        actions={
          <>
            <CallButton mobile={job.customerMobile} />
            <WhatsAppButton mobile={job.customerMobile} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/jobs/${job.id}/edit`}>
                <Pencil className="size-3.5" /> Edit
              </Link>
            </Button>
            {job.certificate && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/certificates/${job.certificate.id}/pdf`} target="_blank" rel="noreferrer">
                  <FileText className="size-3.5" /> Certificate
                </a>
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Job Status</CardTitle>
              <JobStatusBadge status={job.status} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Scheduled</p>
                  <p className="font-medium text-foreground">
                    {formatDate(job.scheduledDate)} · {job.scheduledTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Job Value</p>
                  <p className="font-medium text-foreground">{formatINR(job.jobValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Supervisor</p>
                  <p className="font-medium text-foreground">{job.supervisor?.name ?? "—"}</p>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="font-medium text-foreground">{job.address}</p>
                </div>
                {job.notes && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="font-medium text-foreground">{job.notes}</p>
                  </div>
                )}
              </div>
              <StatusActions jobId={job.id} status={job.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" /> Assigned Crew
              </CardTitle>
            </CardHeader>
            <CardContent>
              {job.assignments.length === 0 ? (
                <EmptyState title="No crew assigned" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {job.assignments.map((a) => (
                    <span
                      key={a.id}
                      className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground"
                    >
                      {a.staff.name}
                      {a.isLead && " (Lead)"}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Before Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {beforePhotos.length === 0 ? (
                <EmptyState title="No before photos yet" />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {beforePhotos.map((p) => (
                    <img key={p.id} src={p.url} alt={p.caption ?? "Before photo"} className="aspect-square w-full rounded-lg border border-border object-cover" />
                  ))}
                </div>
              )}
              <PhotoUploader jobId={job.id} type="BEFORE" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>After Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {afterPhotos.length === 0 ? (
                <EmptyState title="No after photos yet" />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {afterPhotos.map((p) => (
                    <img key={p.id} src={p.url} alt={p.caption ?? "After photo"} className="aspect-square w-full rounded-lg border border-border object-cover" />
                  ))}
                </div>
              )}
              <PhotoUploader jobId={job.id} type="AFTER" />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Signature</CardTitle>
            </CardHeader>
            <CardContent>
              <SignatureCapture jobId={job.id} existingUrl={job.customerSignatureUrl} />
            </CardContent>
          </Card>

          {job.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Invoice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {job.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">Due {formatDate(p.dueDate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{formatINR(p.amount)}</span>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {job.activityLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-3 border-l border-border pl-4">
                  {job.activityLogs.map((log) => (
                    <div key={log.id} className="relative">
                      <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-primary" />
                      <p className="text-sm text-foreground">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)} {log.actor && `· ${log.actor.name}`}
                      </p>
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
