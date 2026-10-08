import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronDown, FileText, Pencil, Phone, MessageCircle, Navigation, Receipt, MapPin } from "lucide-react";
import { getJobDetail, getOwnStaffId, canAccessJob } from "@/server/jobs";
import { getVehiclesForAssignment } from "@/server/vehicles";
import { getResolvedIntegrations } from "@/server/integrations";
import { getCompanySettings } from "@/server/settings";
import { SendPaymentLinkButton } from "@/components/shared/send-payment-link-button";
import { SendBookingFormButton } from "@/components/shared/send-booking-form-button";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { StatusActions } from "@/components/jobs/status-actions";
import { JobNotesEditor } from "@/components/jobs/job-notes-editor";
import { JobLogisticsCard } from "@/components/jobs/job-logistics-card";
import { SendDispatchButton } from "@/components/jobs/send-dispatch-button";
import { JobCardActions } from "@/components/jobs/job-card-actions";
import { GenerateInvoiceButton } from "@/components/jobs/generate-invoice-button";
import { canViewRevenue, canViewJobAmount, canManageStaffFinancials } from "@/lib/permissions";
import { BOOKING_TERMS } from "@/lib/pricing-master";
import { TeamIncentiveCard } from "@/components/jobs/team-incentive-card";
import { db } from "@/lib/db";
import { formatINR, formatDate, toTelLink, toWhatsAppLink } from "@/lib/utils";
import { SERVICE_LABELS, TEAM_INCENTIVE_AMOUNT } from "@/lib/constants";
import { jobCardMessage } from "@/lib/whatsapp-templates";
import { buildDirectionsLink, parseMapLink } from "@/lib/maps";
import { requireUser } from "@/lib/current-user";
import { PackageScopeCard } from "@/components/shared/package-scope-card";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { ensureJobToken } from "@/server/booking-messages";

/** One compact row: label left, value right (stacks only when the value is long). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

/** Collapsible section inside the workspace — closed by default to keep the page short. */
function Fold({ title, hint, children, open = false }: { title: string; hint?: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-t first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 text-sm font-semibold">
        <span className="min-w-0 truncate">{title}{hint ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{hint}</span> : null}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-3">{children}</div>
    </details>
  );
}

const PAY_TONE: Record<string, string> = {
  Paid: "bg-emerald-100 text-emerald-800",
  Partial: "bg-amber-100 text-amber-800",
  Unpaid: "bg-red-100 text-red-700",
};

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
  // above already redirects him away from any other date.
  // Field Staff never see customer phone numbers (Staff App rule).
  const canSeeCustomerContact = session.role !== "STAFF";
  // Payment ledger / expenses — owner + Accounts only.
  const showMoney = canViewRevenue(session.role);
  // Job amount / advance / balance — also Operations (no payment ledger, expenses or profit).
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

  const advance = job.payments.reduce((s, p) => s + (p.paidAmount ?? 0), 0);
  const balance = Math.max(job.jobValue - advance, 0);
  const paymentStatus = balance <= 0 && advance > 0 ? "Paid" : advance > 0 ? "Partial" : "Unpaid";
  const totalExpenses = job.expenses.reduce((s, e) => s + e.amount, 0);
  const completed = job.status === "COMPLETED";
  const serviceLabel = SERVICE_LABELS[job.service] ?? job.service;
  const packageLabel = job.packageName || null;
  const crew = job.assignments.map((a) => ({ id: a.id, name: a.staff.name, lead: a.isLead }));

  const cardBase = {
    jobNumber: job.jobNumber,
    customerName: job.customerName,
    mobile: job.customerMobile,
    alternateMobile: job.alternateMobile,
    address: job.address,
    mapLink: job.mapLink,
    date: job.scheduledDate,
    timeSlot: job.scheduledTime,
    service: serviceLabel,
    flatType: job.serviceVariant,
    packageName: job.packageName,
    team: job.teamNumber,
    crew: crew.map((c) => c.name),
    supervisor: null,
    // Money only for roles that may see it — this text is sent to the client
    // as a prop, so hiding it in the UI alone would still leak it to Staff.
    paymentStatus: showJobAmount ? paymentStatus : null,
    advance: showJobAmount ? advance : null,
    balance: showJobAmount ? balance : null,
    notes: job.notes,
  } as const;
  const officeCardText = jobCardMessage({ ...cardBase, audience: "office" });
  const teamCardText = jobCardMessage({ ...cardBase, audience: "team" });

  // Customer documents (secure token links) — Super Admin, Operations and Accounts.
  // Sending opens WhatsApp with the message pre-filled; staff still press send themselves.
  const canSendDocs = canManage && showJobAmount && !job.isDemo;
  const docToken = canSendDocs ? (job.publicToken ?? (await ensureJobToken(job.id))) : null;
  const quotationUrl = docToken ? `${PUBLIC_BOOKING_URL}/booking/quotation/${docToken}` : "";
  // The final invoice exists only once the job is completed (the public route 404s before that too).
  const invoiceUrl = docToken && completed ? `${PUBLIC_BOOKING_URL}/booking/invoice/${docToken}` : "";
  const docMessage = (label: string, url: string) =>
    `Hi ${job.customerName}, here is your ${label} from Sahara Cleaning Services for booking ${job.jobNumber}:\n${url}\n\nFor any help, call or WhatsApp 7083347130 / 8956567130.`;
  const leadQuote = job.lead?.quotations[0] ?? null;

  const coords = job.mapLink ? parseMapLink(job.mapLink) : null;
  const directions = coords ? buildDirectionsLink(coords) : job.mapLink;

  return (
    <div className="space-y-3">
      <PageHeader
        title={job.customerName}
        description={[job.jobNumber, serviceLabel, packageLabel].filter(Boolean).join(" · ")}
        actions={
          <>
            {canSeeCustomerContact && (
              <>
                <CallButton mobile={job.customerMobile} />
                <WhatsAppButton mobile={job.customerMobile} />
              </>
            )}
            {canManage && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/jobs/${job.id}/edit`}>
                  <Pencil className="size-3.5" /> Edit
                </Link>
              </Button>
            )}
            {/* One contextual document action: Quotation before completion, Invoice after. */}
            {invoiceUrl ? (
              <Button size="sm" asChild>
                <a href={invoiceUrl} target="_blank" rel="noreferrer">
                  <Receipt className="size-3.5" /> Invoice
                </a>
              </Button>
            ) : quotationUrl && !completed ? (
              <Button size="sm" asChild>
                <a href={quotationUrl} target="_blank" rel="noreferrer">
                  <FileText className="size-3.5" /> Quotation
                </a>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
        {/* ── JOB STATUS workspace ─────────────────────────────── */}
        <section className="rounded-xl border bg-card p-3 sm:p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Job Status</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{formatDate(job.scheduledDate)} · {job.scheduledTime}</span>
              <JobStatusBadge status={job.status} />
            </div>
          </div>

          {showJobAmount && (
            <div className="mt-3 grid grid-cols-3 divide-x rounded-lg border text-center">
              <div className="px-1 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Job Amount</p>
                <p className="text-sm font-bold sm:text-base">{formatINR(job.jobValue)}</p>
              </div>
              <div className="px-1 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Advance</p>
                <p className="text-sm font-bold text-success sm:text-base">{formatINR(advance)}</p>
              </div>
              <div className="px-1 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</p>
                <p className="text-sm font-bold sm:text-base">{formatINR(balance)}</p>
                <span className={`mt-0.5 inline-block rounded-full px-1.5 text-[10px] font-semibold ${PAY_TONE[paymentStatus]}`}>{paymentStatus}</span>
              </div>
            </div>
          )}

          <div className="mt-1 divide-y">
            <div className="py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Team</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium">{job.teamNumber ? `Team ${job.teamNumber}` : "No team"}</span>
                  {canManage && crew.length > 0 && <SendDispatchButton jobId={job.id} />}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap justify-end gap-1">
                {crew.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No crew assigned yet</span>
                ) : (
                  crew.map((c) => (
                    <span key={c.id} className="rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs font-medium">
                      {c.name}{c.lead ? " (Lead)" : ""}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
              <Row label="Property / Flat">{job.serviceVariant ?? "—"}</Row>
              <Row label="Package">{packageLabel ?? serviceLabel}</Row>
              {canSeeCustomerContact && (
                <Row label="Customer Phone">
                  <a href={toTelLink(job.customerMobile)} className="text-primary">{job.customerMobile}</a>
                  {job.alternateMobile && <span className="block text-xs text-muted-foreground">Alt {job.alternateMobile}</span>}
                </Row>
              )}
              <Row label="Location">
                {job.mapLink ? (
                  <span className="inline-flex gap-3">
                    <a href={job.mapLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary"><MapPin className="size-3.5" /> Maps</a>
                    {directions && <a href={directions} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary"><Navigation className="size-3.5" /> Navigate</a>}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not shared</span>
                )}
              </Row>
            </div>
            <Row label="Service Address">{job.address}</Row>
          </div>

          <div className="mt-2 border-t pt-3">
            <StatusActions
              jobId={job.id}
              status={job.status}
              scheduledDate={new Date(job.scheduledDate.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)}
              scheduledTime={job.scheduledTime}
            />
          </div>

          {/* Quotation → Invoice: the only place these controls live. */}
          {canSendDocs && (
            <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-2.5 text-sm">
              {!completed ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-semibold">Quotation</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      {leadQuote ? `${leadQuote.quoteNumber} · ${leadQuote.status.toLowerCase()}` : "from booking"} · invoice after completion
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    <Button size="sm" variant="outline" asChild>
                      <a href={quotationUrl} target="_blank" rel="noreferrer"><FileText className="size-3.5" /> View</a>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={toWhatsAppLink(job.customerMobile, docMessage("quotation", quotationUrl))} target="_blank" rel="noreferrer">
                        <MessageCircle className="size-3.5" /> Send
                      </a>
                    </Button>
                  </span>
                </div>
              ) : job.invoice ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-semibold">Final Invoice</span>{" "}
                    <span className="text-xs text-muted-foreground">{job.invoice.invoiceNumber}</span>{" "}
                    <span className={`rounded-full px-1.5 text-[10px] font-semibold ${PAY_TONE[paymentStatus]}`}>{paymentStatus}</span>
                  </span>
                  <span className="flex gap-1.5">
                    <Button size="sm" variant="outline" asChild>
                      <a href={invoiceUrl} target="_blank" rel="noreferrer"><Receipt className="size-3.5" /> View</a>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/api/invoices/${job.invoice.id}/pdf`} target="_blank" rel="noreferrer"><FileText className="size-3.5" /> PDF</a>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={toWhatsAppLink(job.customerMobile, docMessage("final invoice", invoiceUrl))} target="_blank" rel="noreferrer">
                        <MessageCircle className="size-3.5" /> Send
                      </a>
                    </Button>
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Completed before auto-invoicing — no final invoice yet.</span>
                  <GenerateInvoiceButton jobId={job.id} />
                </div>
              )}
              {(completed || (showMoney && balance > 0) || job.certificate) && (
                <div className="flex flex-wrap gap-1.5">
                  {showMoney && balance > 0 && (
                    <SendPaymentLinkButton
                      mobile={job.customerMobile}
                      details={paymentDetails}
                      context={{
                        customerName: job.customerName,
                        bookingId: job.jobNumber,
                        service: serviceLabel,
                        packageName: job.packageName,
                        quote: job.jobValue,
                        advance,
                        balance,
                      }}
                      purpose="BALANCE"
                    />
                  )}
                  {completed && <SendBookingFormButton name={job.customerName} mobile={job.customerMobile} jobId={job.id} kind="REVIEW" />}
                  {job.certificate && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/certificates/${job.certificate.id}/pdf`} target="_blank" rel="noreferrer">
                        <FileText className="size-3.5" /> Certificate
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Details: collapsed by default ───────────────────── */}
        <section className="rounded-xl border bg-card px-3 sm:px-4">
          <Fold title="Scope of Work" hint={job.priceType === "FESTIVAL" ? `Festival${job.festivalName ? ` · ${job.festivalName}` : ""}` : job.priceType ? "Regular price" : undefined}>
            <div className="space-y-2">
              {job.scopeOfWork && <p className="whitespace-pre-line text-sm">{job.scopeOfWork}</p>}
              <PackageScopeCard service={job.service} packageName={job.packageName} serviceVariant={job.serviceVariant} embedded />
              {!job.scopeOfWork && job.service !== "HOME_DEEP_CLEANING" && <p className="text-xs text-muted-foreground">As per booking / quotation.</p>}
            </div>
          </Fold>
          <Fold title="Terms & Conditions">
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              {BOOKING_TERMS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Fold>
          <Fold title="Notes / Remarks" hint={job.notes ? "1 note" : undefined}>
            <JobNotesEditor jobId={job.id} notes={job.notes} />
          </Fold>
          <Fold title="Job Card" hint="PDF · share to team">
            <JobCardActions
              jobId={job.id}
              jobNumber={job.jobNumber}
              officeShareText={canSeeCustomerContact ? officeCardText : teamCardText}
              teamShareText={teamCardText}
              canSeeContact={canSeeCustomerContact}
            />
          </Fold>
          <Fold title="Location, Vehicle & Materials" hint={job.vehicle?.name ?? undefined}>
            <JobLogisticsCard
              jobId={job.id}
              mapLink={job.mapLink}
              vehicleId={job.vehicleId}
              vehicleName={job.vehicle?.name ?? null}
              vehicles={vehicles}
              materials={job.materialIssues}
              canEdit={canManage}
              mapsApiKey={googleMaps.apiKey}
              embedded
            />
          </Fold>
          {canIncentive && (
            <Fold title="Team Incentive" hint={teamIncentive ? "recorded" : completed ? "not recorded" : undefined}>
              <TeamIncentiveCard
                jobId={job.id}
                completed={completed}
                teamSize={job.assignments.length}
                amount={TEAM_INCENTIVE_AMOUNT}
                canReverse={session.role === "ADMIN"}
                embedded
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
            </Fold>
          )}
          {/* Job expenses carry cost amounts — Super Admin / Accounts only. */}
          {showMoney && job.expenses.length > 0 && (
            <Fold title="Job Expenses" hint={formatINR(totalExpenses)}>
              <div className="space-y-1.5">
                {job.expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{e.description} <span className="text-xs text-muted-foreground">· {formatDate(e.date)}</span></span>
                    <span className="shrink-0 font-semibold">{formatINR(e.amount)}</span>
                  </div>
                ))}
              </div>
            </Fold>
          )}
        </section>
      </div>

      {/* Mobile sticky action bar — the field's core actions. */}
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
        {directions ? (
          <Button asChild className="flex-1" size="lg" variant="outline">
            <a href={directions} target="_blank" rel="noreferrer">
              <Navigation className="size-4" /> Maps
            </a>
          </Button>
        ) : null}
      </div>
      <div className="h-16 lg:hidden" />
    </div>
  );
}
