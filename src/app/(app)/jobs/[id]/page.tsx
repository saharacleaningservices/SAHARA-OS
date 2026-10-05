import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText, Users, Pencil, ExternalLink, Phone, MessageCircle, Navigation, Receipt } from "lucide-react";
import { getJobDetail, getOwnStaffId, canAccessJob } from "@/server/jobs";
import { getVehiclesForAssignment } from "@/server/vehicles";
import { getResolvedIntegrations } from "@/server/integrations";
import { getCompanySettings } from "@/server/settings";
import { SendPaymentLinkButton } from "@/components/shared/send-payment-link-button";
import { SendBookingFormButton } from "@/components/shared/send-booking-form-button";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { StatusActions } from "@/components/jobs/status-actions";
import { JobNotesEditor } from "@/components/jobs/job-notes-editor";
import { PhotoUploader } from "@/components/jobs/photo-uploader";
import { VideoUploader } from "@/components/jobs/video-uploader";
import { JobLogisticsCard } from "@/components/jobs/job-logistics-card";
import { SendDispatchButton } from "@/components/jobs/send-dispatch-button";
import { JobCardActions } from "@/components/jobs/job-card-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { canViewRevenue, canViewJobAmount, canManageStaffFinancials } from "@/lib/permissions";
import { BOOKING_TERMS } from "@/lib/pricing-master";
import { TeamIncentiveCard } from "@/components/jobs/team-incentive-card";
import { db } from "@/lib/db";
import { formatINR, formatDate, formatDateTime, toTelLink, toWhatsAppLink } from "@/lib/utils";
import { SERVICE_LABELS, TEAM_INCENTIVE_AMOUNT } from "@/lib/constants";
import { jobCardMessage } from "@/lib/whatsapp-templates";
import { buildDirectionsLink, parseMapLink } from "@/lib/maps";
import { requireUser } from "@/lib/current-user";
import { PackageScopeCard } from "@/components/shared/package-scope-card";
import { BookedScopeCard } from "@/components/shared/booked-scope-card";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const job = await getJobDetail(id);
  if (!job) notFound();

  const ownStaffId = await getOwnStaffId(session.sub);
  if (!canAccessJob(session, job, ownStaffId)) {
    redirect("/jobs");
  }
  const canManage = session.role === "ADMIN" || session.role === "OPERATIONS" || session.role === "ACCOUNTS";
  // Customer phone + click-to-call. Francis (OPERATIONS) — owner decision
  // 2026-10-05: full detail incl. phone for TODAY + TOMORROW only; canAccessJob
  // above already redirects him away from any other date, so every job that
  // reaches this line for him is today's or tomorrow's.
  // Field Staff never see customer phone numbers (Staff App rule) — they reach the customer via the office.
  const canSeeCustomerContact = session.role !== "STAFF";
  // Job value, advance, balance, invoices — owner + Accounts only. Francis
  // and field roles get job information without any money figures.
  const showMoney = canViewRevenue(session.role);
  // Job amount / advance / balance — also Operations & Supervisor (no payment ledger, expenses or profit).
  const showJobAmount = canViewJobAmount(session.role);
  const canIncentive = canManageStaffFinancials(session.role);
  const [vehicles, { googleMaps }, settings, teamIncentive] = await Promise.all([
    canManage ? getVehiclesForAssignment() : Promise.resolve([]),
    getResolvedIntegrations(),
    getCompanySettings(),
    canIncentive ? db.teamIncentive.findUnique({ where: { jobId: job.id } }) : Promise.resolve(null),
  ]);
  const paymentDetails = {
    upiId: settings.upiId ?? null,
    upiQrUrl: settings.upiQrUrl ?? null,
    bankName: settings.bankName ?? null,
    bankAccountName: settings.bankAccountName ?? null,
    bankAccountNumber: settings.bankAccountNumber ?? null,
    bankIfsc: settings.bankIfsc ?? null,
  };

  const beforePhotos = job.photos.filter((p) => p.type === "BEFORE");
  const afterPhotos = job.photos.filter((p) => p.type === "AFTER");

  const advance = job.payments.reduce((s, p) => s + (p.paidAmount ?? 0), 0);
  const balance = Math.max(job.jobValue - advance, 0);
  const paymentStatus = balance <= 0 && advance > 0 ? "Paid" : advance > 0 ? "Partly Paid" : "Pending";
  const totalExpenses = job.expenses.reduce((s, e) => s + e.amount, 0);

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
    // Money only for roles that may see it — this text is sent to the client
    // as a prop, so hiding it in the UI alone would still leak it to Staff/Operations.
    paymentStatus: showJobAmount ? paymentStatus : null,
    advance: showJobAmount ? advance : null,
    balance: showJobAmount ? balance : null,
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
            {canSeeCustomerContact && (
              <>
                <CallButton mobile={job.customerMobile} />
                <WhatsAppButton mobile={job.customerMobile} />
              </>
            )}
            {canManage && job.status === "COMPLETED" && (
              <SendBookingFormButton name={job.customerName} mobile={job.customerMobile} jobId={job.id} kind="REVIEW" />
            )}
            {canManage && showMoney && balance > 0 && (
              <SendPaymentLinkButton
                mobile={job.customerMobile}
                details={paymentDetails}
                context={{
                  customerName: job.customerName,
                  bookingId: job.jobNumber,
                  service: SERVICE_LABELS[job.service] ?? job.service,
                  packageName: job.packageName,
                  quote: job.jobValue,
                  advance,
                  balance,
                }}
                purpose="BALANCE"
              />
            )}
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
            {job.publicToken && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/j/${job.jobNumber}?t=${job.publicToken}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" /> Customer Page
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
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" /> Job Card
              </CardTitle>
            </CardHeader>
            <CardContent>
              <JobCardActions
                jobId={job.id}
                jobNumber={job.jobNumber}
                officeShareText={canSeeCustomerContact ? officeCardText : teamCardText}
                teamShareText={teamCardText}
                canSeeContact={canSeeCustomerContact}
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
                {showJobAmount && (
                  <>
                <div>
                  <p className="text-xs text-muted-foreground">Job Amount</p>
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
                  </>
                )}
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
                {canSeeCustomerContact && job.alternateMobile && (
                  <div>
                    <p className="text-xs text-muted-foreground">Alternate Number</p>
                    <p className="font-medium text-foreground">{job.alternateMobile}</p>
                  </div>
                )}
                {canSeeCustomerContact && (
                  <div>
                    <p className="text-xs text-muted-foreground">Customer Phone</p>
                    <a href={toTelLink(job.customerMobile)} className="font-medium text-primary underline-offset-2 hover:underline">{job.customerMobile}</a>
                  </div>
                )}
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="font-medium text-foreground">{job.address}</p>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Notes / Remarks</p>
                <JobNotesEditor jobId={job.id} notes={job.notes} />
              </div>
              <StatusActions
                jobId={job.id}
                status={job.status}
                scheduledDate={new Date(job.scheduledDate.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)}
                scheduledTime={job.scheduledTime}
              />
            </CardContent>
          </Card>

          <BookedScopeCard priceType={job.priceType} festivalName={job.festivalName} scopeOfWork={job.scopeOfWork} />
          <PackageScopeCard service={job.service} packageName={job.packageName} serviceVariant={job.serviceVariant} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Terms &amp; conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                {BOOKING_TERMS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
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
          {canIncentive && (
            <TeamIncentiveCard
              jobId={job.id}
              completed={job.status === "COMPLETED"}
              teamSize={job.assignments.length}
              amount={TEAM_INCENTIVE_AMOUNT}
              canReverse={session.role === "ADMIN"}
              incentive={
                teamIncentive
                  ? {
                      amount: teamIncentive.amount,
                      date: teamIncentive.date,
                      recordedByName: teamIncentive.recordedByName,
                      team: JSON.parse(teamIncentive.teamSnapshot) as { name: string }[],
                    }
                  : null
              }
            />
          )}
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

          {showMoney && job.payments.length > 0 && (
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

          {/* Job Expenses carries cost amounts — financial data. Francis
              (SUPERVISOR) must not see Expenses in any form, including
              tied to a specific job (2026-09-22 policy). */}
          {showMoney && job.expenses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="size-4" /> Job Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {job.expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(e.date)}
                        {e.paidTo ? ` · ${e.paidTo}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{formatINR(e.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold text-foreground">
                  <span>Total spent on this job</span>
                  <span>{formatINR(totalExpenses)}</span>
                </div>
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
        {canSeeCustomerContact && (
          <>
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
          </>
        )}
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
