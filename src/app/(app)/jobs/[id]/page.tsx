import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText, Users, Pencil, ExternalLink, Phone, MessageCircle, Navigation } from "lucide-react";
import { getJobDetail, getOwnStaffId, canAccessJob } from "@/server/jobs";
import { getVehiclesForAssignment } from "@/server/vehicles";
import { getResolvedIntegrations } from "@/server/integrations";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { StatusActions } from "@/components/jobs/status-actions";
import { PhotoUploader } from "@/components/jobs/photo-uploader";
import { VideoUploader } from "@/components/jobs/video-uploader";
import { JobLogisticsCard } from "@/components/jobs/job-logistics-card";
import { SendDispatchButton } from "@/components/jobs/send-dispatch-button";
import { JobCardActions } from "@/components/jobs/job-card-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { formatINR, formatDate, formatDateTime, toTelLink, toWhatsAppLink } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";
import { jobCardMessage } from "@/lib/whatsapp-templates";
import { buildDirectionsLink, parseMapLink } from "@/lib/maps";
import { requireUser } from "@/lib/current-user";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const job = await getJobDetail(id);
  if (!job) notFound();

  const ownStaffId = await getOwnStaffId(session.sub);
  if (!canAccessJob(session, job, ownStaffId)) {
    redirect("/jobs");
  }
  const canManage = session.role === "ADMIN" || session.role === "OPERATIONS";
  const [vehicles, { googleMaps }] = await Promise.all([
    canManage ? getVehiclesForAssignment() : Promise.resolve([]),
    getResolvedIntegrations(),
  ]);

  const beforePhotos = job.photos.filter((p) => p.type === "BEFORE");
  const afterPhotos = job.photos.filter((p) => p.type === "AFTER");

  const advance = job.payments.reduce((s, p) => s + (p.paidAmount ?? 0), 0);
  const balance = Math.max(job.jobValue - advance, 0);
  const paymentStatus = balance <= 0 && advance > 0 ? "Paid" : advance > 0 ? "Partly Paid" : "Pending";

  const cardBase = {
    jobNumber: job.jobNumber,
    customerName: job.customerName,
    mobile: job.customerMobile,
    alternateMobile: job.alternateMobile,
    address: job.address,
    mapLink: job.mapLink,
    date: job.scheduledDate,
    timeSlot: job.scheduledTime,
    service: SERVICE_LABELS[job.service] ?? job.service,
    flatType: job.serviceVariant,
    packageName: job.packageName,
    team: job.teamNumber,
    crew: job.assignments.map((a) => a.staff.name),
    supervisor: job.supervisor?.name ?? null,
    paymentStatus,
    advance,
    balance,
    notes: job.notes,
  } as const;
  const officeCardText = jobCardMessage({ ...cardBase, audience: "office" });
  const teamCardText = jobCardMessage({ ...cardBase, audience: "team" });

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.customerName}
        description={`${job.jobNumber} · ${SERVICE_LABELS[job.service]} · ${job.area}`}
        actions={
          <>
            <CallButton mobile={job.customerMobile} />
            <WhatsAppButton mobile={job.customerMobile} />
            {canManage && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/jobs/${job.id}/edit`}>
                  <Pencil className="size-3.5" /> Edit
                </Link>
              </Button>
            )}
            {job.certificate && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/certificates/${job.certificate.id}/pdf`} target="_blank" rel="noreferrer">
                  <FileText className="size-3.5" /> Certificate
                </a>
              </Button>
            )}
            {job.invoice && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/invoices/${job.invoice.id}/pdf`} target="_blank" rel="noreferrer">
                  <FileText className="size-3.5" /> Invoice
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={`/j/${job.jobNumber}`} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" /> Customer Page
              </a>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" /> Job Card
              </CardTitle>
            </CardHeader>
            <CardContent>
              <JobCardActions
                jobId={job.id}
                jobNumber={job.jobNumber}
                officeShareText={officeCardText}
                teamShareText={teamCardText}
                canSeeContact={canManage}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Job Status</CardTitle>
              <JobStatusBadge status={job.status} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Date &amp; Time Slot</p>
                  <p className="font-medium text-foreground">
                    {formatDate(job.scheduledDate)} · {job.scheduledTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Job Value</p>
                  <p className="font-medium text-foreground">{formatINR(job.jobValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Advance Received</p>
                  <p className="font-medium text-success">{formatINR(advance)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Balance Amount</p>
                  <p className="font-medium text-foreground">
                    {formatINR(balance)} <span className="text-xs text-muted-foreground">({paymentStatus})</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Supervisor</p>
                  <p className="font-medium text-foreground">{job.supervisor?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Team</p>
                  <p className="font-medium text-foreground">
                    {job.teamNumber ? `Team ${job.teamNumber}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Flat / Type</p>
                  <p className="font-medium text-foreground">{job.serviceVariant ?? "—"}</p>
                </div>
                {job.alternateMobile && (
                  <div>
                    <p className="text-xs text-muted-foreground">Alternate Number</p>
                    <p className="font-medium text-foreground">{job.alternateMobile}</p>
                  </div>
                )}
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
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" /> Assigned Crew
              </CardTitle>
              {canManage && job.assignments.length > 0 && <SendDispatchButton jobId={job.id} />}
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

          <Card>
            <CardHeader>
              <CardTitle>Job Videos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {job.videos.length === 0 ? (
                <EmptyState title="No videos yet" />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {job.videos.map((v) => (
                    <video key={v.id} src={v.url} controls className="w-full rounded-lg border border-border" />
                  ))}
                </div>
              )}
              <VideoUploader jobId={job.id} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <JobLogisticsCard
            jobId={job.id}
            mapLink={job.mapLink}
            vehicleId={job.vehicleId}
            vehicleName={job.vehicle?.name ?? null}
            vehicles={vehicles}
            materials={job.materialIssues}
            canEdit={canManage}
            mapsApiKey={googleMaps.apiKey}
          />

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

      {/* Mobile sticky action bar — Field Coordinator's core actions. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border bg-card/95 px-3 py-2.5 backdrop-blur lg:hidden">
        <Button asChild className="flex-1" size="lg" variant="outline">
          <a href={toTelLink(job.customerMobile)}>
            <Phone className="size-4" /> Call
          </a>
        </Button>
        <Button asChild className="flex-1 text-success" size="lg" variant="outline">
          <a href={toWhatsAppLink(job.customerMobile)} target="_blank" rel="noreferrer">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        </Button>
        {(() => {
          const c = job.mapLink ? parseMapLink(job.mapLink) : null;
          const href = c ? buildDirectionsLink(c) : job.mapLink;
          return href ? (
            <Button asChild className="flex-1" size="lg" variant="outline">
              <a href={href} target="_blank" rel="noreferrer">
                <Navigation className="size-4" /> Maps
              </a>
            </Button>
          ) : null;
        })()}
      </div>
      <div className="h-16 lg:hidden" />
    </div>
  );
}
