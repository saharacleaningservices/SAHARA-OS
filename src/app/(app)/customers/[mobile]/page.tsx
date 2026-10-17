import { notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardList, MessageSquare, Plus, Star, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { LeadStageBadge, JobStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { SendBookingFormButton } from "@/components/shared/send-booking-form-button";
import { RepeatBookingButton } from "@/components/customers/repeat-booking-button";
import { EditCustomerDialog } from "@/components/customers/edit-customer-dialog";
import { ContactMetaDialog } from "@/components/customers/contact-meta-dialog";
import { CustomerSitesCard } from "@/components/customers/customer-sites-card";
import { PackageCalculatorButton } from "@/components/layout/package-calculator-dialog";
import { ContactTypeBadge, RepeatBadge } from "@/components/customers/contact-badges";
import { getCustomerHistory } from "@/server/customers";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";
import { formatINR, formatDate, formatDateTime } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";

export default async function CustomerDetailPage({ params }: { params: Promise<{ mobile: string }> }) {
  const { mobile } = await params;
  // Restricted module: explicit page-level guard (Super Admin, Accounts).
  const session = await requireRole(["ADMIN", "ACCOUNTS"]);
  const canEdit = session.role === "ADMIN" || session.role === "ACCOUNTS";
  const { leads, jobs, payments, reviews, master } = await getCustomerHistory(mobile);
  if (leads.length === 0 && jobs.length === 0 && payments.length === 0 && !master) notFound();

  const digits = mobile.replace(/[^\d]/g, "").slice(-10);
  const name = master?.name || leads[0]?.name || jobs[0]?.customerName || "Customer";
  const totalRevenue = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.paidAmount, 0);
  const outstanding = master?.outstandingBalance ?? 0;
  const allPhotos = jobs.flatMap((j) => j.photos);
  const contactType = master?.contactType ?? "CUSTOMER";
  const isRepeat = !!master?.isRepeat || jobs.length > 1 || (jobs.length >= 1 && leads.length >= 1);
  const alternate = master?.alternateMobile ?? leads[0]?.alternateMobile ?? null;
  const email = master?.email ?? leads[0]?.email ?? null;
  const bookingLinks = await db.bookingLink
    .findMany({ where: { customerMobile: digits }, orderBy: { sentAt: "desc" }, take: 10 })
    .catch(() => []);
  const sites = master?.sites ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {name}
            <ContactTypeBadge type={contactType} />
            {isRepeat && <RepeatBadge partner={contactType !== "CUSTOMER"} />}
          </span>
        }
        description={[master?.customerNumber ?? null, digits, alternate ? `Alt ${alternate}` : null, email].filter(Boolean).join(" · ")}
        actions={
          <>
            <CallButton mobile={digits} />
            <WhatsAppButton mobile={digits} />
            <Button asChild size="sm">
              <Link href={`/leads/new?mobile=${digits}&name=${encodeURIComponent(name)}`}><Plus className="size-3.5" /> New Lead</Link>
            </Button>
            <PackageCalculatorButton variant="button" prefill={{ mobile: digits, name }} />
            {(jobs.length > 0 || master) && <RepeatBookingButton mobile={digits} />}
            {canEdit && <ContactMetaDialog mobile={digits} initial={{ name, email, contactType, isRepeat: !!master?.isRepeat }} />}
            <SendBookingFormButton name={name} mobile={digits} leadId={leads[0]?.id} />
            <SendBookingFormButton name={name} mobile={digits} leadId={leads[0]?.id} kind="PAYMENT" />
            <SendBookingFormButton name={name} mobile={digits} leadId={leads[0]?.id} kind="REVIEW" />
            {canEdit && (
              <EditCustomerDialog
                mobile={digits}
                defaultName={name}
                initial={
                  master
                    ? { name: master.name, alternateMobile: master.alternateMobile, address: master.address, area: master.area, outstandingBalance: master.outstandingBalance, source: master.source }
                    : null
                }
              />
            )}
          </>
        }
      />

      {/* Summary — one compact strip */}
      <div className="grid grid-cols-4 divide-x rounded-xl border bg-card text-center">
        {[
          ["Jobs", String(jobs.length)],
          ["Leads", String(leads.length)],
          ["Lifetime value", formatINR(totalRevenue)],
          ["Outstanding", formatINR(outstanding)],
        ].map(([k, v]) => (
          <div key={k} className="px-1 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">{k}</p>
            <p className={`text-sm font-bold sm:text-base ${k === "Outstanding" && outstanding > 0 ? "text-destructive" : ""}`}>{v}</p>
          </div>
        ))}
      </div>

      <CustomerSitesCard
        mobile={digits}
        name={name}
        canEdit={canEdit}
        sites={sites.map((s) => ({ id: s.id, label: s.label, address: s.address, pinCode: s.pinCode, area: s.area, mapLink: s.mapLink, notes: s.notes }))}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {jobs.length > 0 && (
            <details open className="group rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold"><ClipboardList className="size-4" /> Recent jobs ({jobs.length})</summary>
              <div className="space-y-1.5 px-3 pb-3">
                {jobs.slice(0, 10).map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{job.jobNumber} · {SERVICE_LABELS[job.service] ?? job.service}</p>
                      <p className="truncate text-xs text-muted-foreground">{formatDate(job.scheduledDate)} · {formatINR(job.jobValue)} · {job.area}</p>
                    </div>
                    <JobStatusBadge status={job.status} />
                  </Link>
                ))}
                {allPhotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {allPhotos.slice(0, 8).map((p) => (
                      <img key={p.id} src={p.url} alt={p.caption ?? p.type} className="aspect-square w-full rounded-md border object-cover" />
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}

          {leads.length > 0 && (
            <details open={jobs.length === 0} className="group rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold"><MessageSquare className="size-4" /> Recent enquiries ({leads.length})</summary>
              <div className="space-y-1.5 px-3 pb-3">
                {leads.slice(0, 10).map((lead) => (
                  <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{lead.leadNumber} · {SERVICE_LABELS[lead.service] ?? lead.service}</p>
                      <p className="truncate text-xs text-muted-foreground">{formatDate(lead.createdAt)} · {lead.area}</p>
                    </div>
                    <LeadStageBadge stage={lead.stage} />
                  </Link>
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="space-y-3">
          {payments.length > 0 && (
            <details open className="rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold"><Wallet className="size-4" /> Payments ({payments.length})</summary>
              <div className="space-y-1.5 px-3 pb-3">
                {payments.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                    <div>
                      <p className="text-sm font-medium">{p.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">Due {formatDate(p.dueDate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatINR(p.amount)}</span>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {reviews.length > 0 && (
            <details className="rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold"><Star className="size-4" /> Reviews ({reviews.length})</summary>
              <div className="space-y-1.5 px-3 pb-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-lg border p-2.5">
                    <p className="text-sm font-medium">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>
                    {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </details>
          )}

          {bookingLinks.length > 0 && (
            <details className="rounded-xl border bg-card">
              <summary className="cursor-pointer list-none p-3 text-sm font-semibold">Links sent ({bookingLinks.length})</summary>
              <div className="space-y-1 px-3 pb-3">
                {bookingLinks.map((l) => {
                  const status = l.submittedAt ? "Submitted" : l.openedAt ? "Opened" : "Sent";
                  return (
                    <p key={l.id} className="flex items-center justify-between gap-2 text-xs">
                      <span>{l.kind === "REVIEW" ? "Review request" : l.kind === "FOLLOWUP" ? "Follow-up" : "Booking form"} · {formatDateTime(l.sentAt)}</span>
                      <span className="font-semibold">{status}</span>
                    </p>
                  );
                })}
              </div>
            </details>
          )}

          {master?.serviceHistory && (
            <details className="rounded-xl border bg-card">
              <summary className="cursor-pointer list-none p-3 text-sm font-semibold">Imported service history</summary>
              <p className="px-3 pb-3 text-xs text-muted-foreground">{master.serviceHistory}</p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
