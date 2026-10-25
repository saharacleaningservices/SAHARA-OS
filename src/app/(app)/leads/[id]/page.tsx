import { PackageScopeCard } from "@/components/shared/package-scope-card";
import { BookedScopeCard } from "@/components/shared/booked-scope-card";
import { compactServiceLines, tierFromPackage } from "@/lib/service-scope";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, FileText, ClipboardList, Wallet, CalendarCheck, ChevronDown, CalendarClock } from "lucide-react";
import { getLeadDetail, canAccessLead } from "@/server/leads";
import { requireUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { InquiryOutcomeButtons } from "@/components/leads/inquiry-outcome-buttons";
import { getStaffForAssignment } from "@/server/staff";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { StageSelect } from "@/components/leads/stage-select";
import { QuotationDialog } from "@/components/leads/quotation-dialog";
import { SendQuotationButton } from "@/components/leads/send-quotation-button";
import { RescheduleDialog } from "@/components/leads/reschedule-dialog";
import { SharePdfButton } from "@/components/leads/share-pdf-button";
import { GenerateInvoiceButton } from "@/components/jobs/generate-invoice-button";
import { primaryLeadAction } from "@/lib/lead-primary-action";
import { shortUrlForJob } from "@/server/short-links";
import { ConfirmBookingDialog } from "@/components/leads/confirm-booking-dialog";
import { ConversationTimeline } from "@/components/leads/conversation-timeline";
import { FollowUpsPanel } from "@/components/leads/followups-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { MarketingConsentControl } from "@/components/leads/marketing-consent-control";
import { formatINR, formatDate } from "@/lib/utils";
import { SERVICE_LABELS, LEAD_SOURCE_LABELS } from "@/lib/constants";
import { canSeeCustomerContact, canViewJobAmount } from "@/lib/permissions";
import { HIDDEN_CONTACT, maskText, redactLead } from "@/lib/redact";
import { CustomerServiceHistoryCard } from "@/components/leads/customer-service-history-card";

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ confirm?: string }> }) {
  const { confirm } = await searchParams;
  const { id } = await params;
  const session = await requireUser();
  const [rawLead, staff] = await Promise.all([getLeadDetail(id), getStaffForAssignment()]);
  if (!rawLead) notFound();
  // Francis (SUPERVISOR) final policy, 2026-09-21: direct-URL access to a
  // lead outside his today/tomorrow/active-enquiry window must be blocked
  // here too, not just hidden from the list — this page previously had no
  // session check at all.
  if (!canAccessLead(session, rawLead)) redirect("/leads");
  // Owner rule 2026-10-08: customer contact + amounts only for Super Admin / Accounts.
  const showContact = canSeeCustomerContact(session.role);
  const showMoney = canViewJobAmount(session.role);
  const maskDigits = (t: string) => maskText(t, { contact: showContact, money: showMoney }) ?? "";
  const lead = {
    ...redactLead(rawLead, session.role),
    timeline: rawLead.timeline.map((e) => ({ ...e, body: maskDigits(e.body ?? "") })),
    // Quotation / payment records + PDFs carry the customer number — Super Admin / Accounts only.
    quotations: showContact && showMoney ? rawLead.quotations : [],
    payments: showContact && showMoney ? rawLead.payments.filter((p) => !p.deletedAt) : [],
  };

  // The booking (if any): drives the single primary action and the Overview block.
  const activeJob = await db.job.findFirst({
    where: { leadId: lead.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, teamNumber: true, scheduledDate: true, scheduledTime: true, invoice: { select: { id: true } }, assignments: { select: { isLead: true, staff: { select: { name: true } } } } },
  });
  const primary = primaryLeadAction({ stage: lead.stage, hasJob: !!activeJob, jobStatus: activeJob?.status, hasQuotation: rawLead.quotations.length > 0, hasInvoice: !!activeJob?.invoice, canQuote: showContact && showMoney });
  const invoiceShareUrl = primary === "SHARE_PDF" && activeJob ? await shortUrlForJob("i", activeJob.id) : null;
  const crewNames = (activeJob?.assignments ?? []).sort((a, b) => Number(b.isLead) - Number(a.isLead)).map((a) => a.staff.name);
  const shownDate = activeJob?.scheduledDate ?? lead.serviceDate;
  const shownSlot = activeJob?.scheduledTime ?? lead.timeSlot;
  const supervisors = staff.filter((s) => s.designation === "Supervisor").map((s) => ({ id: s.id, name: s.name }));
  const canConfirm = !["JOB_SCHEDULED", "COMPLETED"].includes(lead.stage);
  const requestedServiceDate = lead.serviceDate ? lead.serviceDate.toISOString().slice(0, 10) : "";
  const requestedTimeSlot = lead.timeSlot ?? "";

  const packageTier = lead.service === "HOME_DEEP_CLEANING" ? tierFromPackage(lead.packageName, lead.serviceVariant) : null;
  const historyShown = showContact && showMoney;
  const visibleJobs = historyShown ? lead.jobs.filter((j) => j.status !== "COMPLETED") : lead.jobs;
  const openFollowUps = lead.followUps.filter((f) => !f.isDone).length;

  // Direct (owner-entered) inquiries get the one-click outcome panel for the office roles.
  const showOutcomes =
    ["ADMIN", "ACCOUNTS", "OPERATIONS"].includes(session.role) &&
    (await db.auditLog.count({ where: { entityType: "Lead", entityId: lead.id, action: { in: ["INQUIRY_CREATED_BY_OWNER", "INQUIRY_REOPENED", "INQUIRY_ALERT_RESENT"] } } })) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.name}
        description={`${lead.leadNumber} · ${SERVICE_LABELS[lead.service]} · ${lead.area}`}
        actions={
          <>
            {showContact && (
              <>
                <CallButton mobile={lead.mobile} />
                <WhatsAppButton mobile={lead.whatsapp || lead.mobile} />
              </>
            )}
            <Button variant="outline" asChild>
              <Link href={`/leads/${lead.id}/edit`}>
                <Pencil className="size-3.5" /> Edit
              </Link>
            </Button>
            {/* ONE contextual primary action (owner 2026-10-24): it follows the status. */}
            {primary === "CREATE_QUOTATION" && (
              <QuotationDialog leadId={lead.id} service={lead.service} suggestedAmount={lead.quoteAmount} area={lead.area} notes={lead.notes} serviceItems={lead.serviceItems} discountAmount={lead.discountAmount} trigger={<Button size="sm"><FileText className="size-3.5" /> Create Quotation</Button>} />
            )}
            {primary === "CONFIRM_BOOKING" && canConfirm && (
              <ConfirmBookingDialog
                leadId={lead.id}
                supervisors={supervisors}
                defaultServiceDate={requestedServiceDate}
                defaultTimeSlot={requestedTimeSlot}
                defaultTeam={lead.teamNumber}
                defaultOpen={confirm === "1" && lead.jobs.length === 0}
                trigger={<Button size="sm"><CalendarCheck className="size-3.5" /> Confirm Booking</Button>}
              />
            )}
            {primary === "RESCHEDULE_JOB" && activeJob && (
              <RescheduleDialog leadId={lead.id} jobId={activeJob.id} defaultDate={requestedServiceDate} defaultSlot={activeJob.scheduledTime} label="Reschedule Job" primary />
            )}
            {primary === "SHARE_PDF" && invoiceShareUrl && <SharePdfButton url={invoiceShareUrl} title={`Invoice — ${lead.name}`} />}
            {primary === "CONVERT_TO_INVOICE" && activeJob && <GenerateInvoiceButton jobId={activeJob.id} />}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Overview & Status (owner 2026-10-25): schedule, status and lead details merged into ONE block — status dropdown
              (incl. Follow-up) and Reschedule inline in the header, so nothing is repeated further down the page. */}
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle>Overview</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-40">
                  <StageSelect
                    leadId={lead.id}
                    stage={lead.stage}
                    supervisors={supervisors}
                    defaultServiceDate={requestedServiceDate}
                    defaultTimeSlot={requestedTimeSlot}
                    defaultTeam={lead.teamNumber}
                  />
                </div>
                {!["CANCELLED", "COMPLETED"].includes(lead.stage) && activeJob?.status !== "COMPLETED" && activeJob?.status !== "CANCELLED" && (
                  <RescheduleDialog leadId={lead.id} jobId={activeJob?.id ?? null} defaultDate={requestedServiceDate} defaultSlot={shownSlot ?? ""} />
                )}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Mobile</p>
                <p className="font-medium text-foreground">{lead.mobile || HIDDEN_CONTACT}</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3" /> Requested Date / Time</p>
                <p className="font-medium text-foreground">{shownDate ? `${formatDate(shownDate)}${shownSlot ? ` · ${shownSlot}` : ""}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Assigned Team</p>
                <p className="font-medium text-foreground">
                  {activeJob?.teamNumber ?? lead.teamNumber ? `Team ${activeJob?.teamNumber ?? lead.teamNumber}` : "—"}
                  {crewNames.length > 0 && <span className="block text-xs font-normal text-muted-foreground">{crewNames.join(", ")}</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Source</p>
                <p className="font-medium text-foreground">{LEAD_SOURCE_LABELS[lead.source]}</p>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="font-medium text-foreground">{lead.address || "—"}</p>
              </div>
              {showMoney && (
                <div>
                  <p className="text-xs text-muted-foreground">Quote Amount</p>
                  <p className="font-medium text-foreground">{lead.quoteAmount ? formatINR(lead.quoteAmount) : "—"}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Assigned To</p>
                <p className="font-medium text-foreground">{lead.assignedTo?.name ?? lead.assignedStaff?.name ?? "—"}</p>
              </div>
              {lead.notes && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="font-medium text-foreground">{lead.notes}</p>
                </div>
              )}
              {/* Secondary details folded away — open when needed (less scrolling on mobile). */}
              <details className="group col-span-2 rounded-lg border border-border sm:col-span-4">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
                  More details (WhatsApp, email, marketing)
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-3 py-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">WhatsApp</p>
                    <p className="font-medium text-foreground">{showContact ? lead.whatsapp || "—" : HIDDEN_CONTACT}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="break-all font-medium text-foreground">{showContact ? lead.email || "—" : HIDDEN_CONTACT}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Marketing channel</p>
                    <p className="font-medium text-foreground">
                      {lead.acquisitionChannel ?? "Not tracked"}
                      {lead.acquisitionCampaign ? ` · ${lead.acquisitionCampaign}` : ""}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-muted-foreground">WhatsApp marketing consent</p>
                    <MarketingConsentControl
                      leadId={lead.id}
                      consent={/OUT/.test(lead.marketingConsent) ? "OPTED_OUT" : /IN$/.test(lead.marketingConsent) ? "OPTED_IN" : "UNKNOWN"}
                      canEdit={session.role === "ADMIN" || session.role === "ACCOUNTS"}
                    />
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>
          <BookedScopeCard priceType={lead.priceType} festivalName={lead.festivalName} scopeOfWork={lead.scopeOfWork} services={compactServiceLines(rawLead)} />
          {/* Long package scope (Platinum / Premium room-by-room) — collapsed by default (owner 2026-10-25). */}
          {packageTier && (
            <details className="group rounded-xl border border-border bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span>Package scope — {lead.packageName || packageTier} <span className="font-normal text-muted-foreground">(tap to view)</span></span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-border px-4 py-3">
                <PackageScopeCard service={lead.service} packageName={lead.packageName} serviceVariant={lead.serviceVariant} embedded />
              </div>
            </details>
          )}
          {showOutcomes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Inquiry follow-up</CardTitle>
                <p className="text-xs text-muted-foreground">Record what happened with one click. This is a report for Altaf&apos;s tracker — it does not change the stage or create a quotation, booking or payment.</p>
              </CardHeader>
              <CardContent>
                <InquiryOutcomeButtons leadId={lead.id} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <ConversationTimeline leadId={lead.id} entries={lead.timeline} />
            </CardContent>
          </Card>

          {/* Past Service History & Invoices (owner 2026-10-22): money + contact, Super Admin / Accounts only. */}
          {showContact && showMoney && <CustomerServiceHistoryCard mobile={rawLead.mobile} />}

          {showContact && showMoney && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" /> Quotations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lead.quotations.length === 0 ? (
                <EmptyState title="No quotations yet" description="Generate a quote to share with the customer." />
              ) : (
                <div className="space-y-2">
                  {lead.quotations.map((q) => (
                    <div key={q.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{q.quoteNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(q.createdAt)} · Valid till {formatDate(q.validTill)} · {q.status.charAt(0) + q.status.slice(1).toLowerCase()}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="text-sm font-semibold text-foreground">{formatINR(q.totalAmount)}</span>
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/api/quotations/${q.id}/pdf`} target="_blank" rel="noreferrer">
                            View PDF
                          </a>
                        </Button>
                        <SendQuotationButton quotationId={q.id} quoteNumber={q.quoteNumber} status={q.status} name={lead.name} mobile={lead.mobile} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Completed jobs already sit in Past Service History & Invoices — here only the bookings still in progress (no duplicate history). */}
          {visibleJobs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4" /> {historyShown ? "Current Booking" : "Jobs"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visibleJobs.length === 0 ? (
                <EmptyState title="No jobs scheduled" description="Once confirmed, schedule a job for this lead." />
              ) : (
                <div className="space-y-2">
                  {visibleJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/40"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{job.jobNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(job.scheduledDate)} · {job.scheduledTime}
                        </p>
                      </div>
                      <JobStatusBadge status={job.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {lead.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="size-4" /> Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lead.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">Due {formatDate(p.dueDate)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-foreground">{formatINR(p.amount)}</span>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Follow-ups: a sidebar on desktop; on mobile a compact fold (open follow-ups counted) so it never adds a long scroll. */}
        <div className="space-y-4">
          <details className="group rounded-xl border border-border bg-card lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <span>Follow-ups{openFollowUps > 0 ? <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{openFollowUps} open</span> : null}</span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border p-4">
              <FollowUpsPanel leadId={lead.id} followUps={lead.followUps} />
            </div>
          </details>
          <Card className="hidden lg:block">
            <CardHeader>
              <CardTitle>Follow-ups</CardTitle>
            </CardHeader>
            <CardContent>
              <FollowUpsPanel leadId={lead.id} followUps={lead.followUps} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
