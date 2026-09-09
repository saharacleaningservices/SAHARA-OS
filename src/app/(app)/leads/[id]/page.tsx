import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, FileText, ClipboardList, Wallet } from "lucide-react";
import { getLeadDetail } from "@/server/leads";
import { getStaffForAssignment } from "@/server/staff";
import { getCompanySettings } from "@/server/settings";
import { SendPaymentLinkButton } from "@/components/shared/send-payment-link-button";
import { SendBookingFormButton } from "@/components/shared/send-booking-form-button";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { StageSelect } from "@/components/leads/stage-select";
import { QuotationDialog } from "@/components/leads/quotation-dialog";
import { ScheduleVisitDialog } from "@/components/leads/schedule-visit-dialog";
import { ConfirmBookingDialog } from "@/components/leads/confirm-booking-dialog";
import { ConversationTimeline } from "@/components/leads/conversation-timeline";
import { FollowUpsPanel } from "@/components/leads/followups-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { formatINR, formatDate } from "@/lib/utils";
import { SERVICE_LABELS, LEAD_SOURCE_LABELS } from "@/lib/constants";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, staff, settings] = await Promise.all([getLeadDetail(id), getStaffForAssignment(), getCompanySettings()]);
  if (!lead) notFound();

  const estimated = lead.quoteAmount ?? 0;
  const advance = lead.advanceAmount ?? 0;
  const leadBalance = Math.max(estimated - advance, 0);
  const paymentDetails = {
    upiId: settings.upiId ?? null,
    upiQrUrl: settings.upiQrUrl ?? null,
    bankName: settings.bankName ?? null,
    bankAccountName: settings.bankAccountName ?? null,
    bankAccountNumber: settings.bankAccountNumber ?? null,
    bankIfsc: settings.bankIfsc ?? null,
  };

  const supervisors = staff.filter((s) => s.designation === "Supervisor").map((s) => ({ id: s.id, name: s.name }));
  const canConfirm = !["JOB_SCHEDULED", "COMPLETED"].includes(lead.stage);
  const requestedServiceDate = lead.serviceDate ? lead.serviceDate.toISOString().slice(0, 10) : "";
  const requestedTimeSlot = lead.timeSlot ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.name}
        description={`${lead.leadNumber} · ${SERVICE_LABELS[lead.service]} · ${lead.area}`}
        actions={
          <>
            <CallButton mobile={lead.mobile} />
            <WhatsAppButton mobile={lead.whatsapp || lead.mobile} />
            <SendBookingFormButton name={lead.name} mobile={lead.whatsapp || lead.mobile} leadId={lead.id} />
            <ScheduleVisitDialog leadId={lead.id} />
            <SendPaymentLinkButton
              mobile={lead.whatsapp || lead.mobile}
              details={paymentDetails}
              context={{
                customerName: lead.name,
                bookingId: lead.leadNumber,
                service: SERVICE_LABELS[lead.service] ?? lead.service,
                packageName: lead.packageName,
                quote: estimated || null,
                advance: advance || null,
                balance: leadBalance || estimated,
              }}
              purpose={advance > 0 ? "BALANCE" : "ADVANCE"}
            />
            <QuotationDialog leadId={lead.id} service={lead.service} suggestedAmount={lead.quoteAmount} area={lead.area} />
            {canConfirm && (
              <ConfirmBookingDialog
                leadId={lead.id}
                supervisors={supervisors}
                defaultServiceDate={requestedServiceDate}
                defaultTimeSlot={requestedTimeSlot}
                defaultTeam={lead.teamNumber}
              />
            )}
            <Button variant="outline" asChild>
              <Link href={`/leads/${lead.id}/edit`}>
                <Pencil className="size-3.5" /> Edit
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <ConversationTimeline leadId={lead.id} entries={lead.timeline} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Overview</CardTitle>
              <div className="w-44">
                <StageSelect
                  leadId={lead.id}
                  stage={lead.stage}
                  supervisors={supervisors}
                  defaultServiceDate={requestedServiceDate}
                  defaultTimeSlot={requestedTimeSlot}
                  defaultTeam={lead.teamNumber}
                />
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Mobile</p>
                <p className="font-medium text-foreground">{lead.mobile}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                <p className="font-medium text-foreground">{lead.whatsapp || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground break-all">{lead.email || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Source</p>
                <p className="font-medium text-foreground">{LEAD_SOURCE_LABELS[lead.source]}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Requested Service Date</p>
                <p className="font-medium text-foreground">
                  {lead.serviceDate ? formatDate(lead.serviceDate) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Team</p>
                <p className="font-medium text-foreground">
                  {lead.teamNumber ? `Team ${lead.teamNumber}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Quote Amount</p>
                <p className="font-medium text-foreground">{lead.quoteAmount ? formatINR(lead.quoteAmount) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Assigned Staff</p>
                <p className="font-medium text-foreground">{lead.assignedStaff?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Assigned To</p>
                <p className="font-medium text-foreground">{lead.assignedTo?.name ?? "—"}</p>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="font-medium text-foreground">{lead.address || "—"}</p>
              </div>
              {lead.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="font-medium text-foreground">{lead.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

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
                          {formatDate(q.createdAt)} · Valid till {formatDate(q.validTill)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-foreground">{formatINR(q.totalAmount)}</span>
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/api/quotations/${q.id}/pdf`} target="_blank" rel="noreferrer">
                            View PDF
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4" /> Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lead.jobs.length === 0 ? (
                <EmptyState title="No jobs scheduled" description="Once confirmed, schedule a job for this lead." />
              ) : (
                <div className="space-y-2">
                  {lead.jobs.map((job) => (
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

        <div className="space-y-4">
          <Card>
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
