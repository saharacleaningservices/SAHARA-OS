import { notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Download, FileText, MessageSquare, Plus, Star, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { LeadStageBadge, JobStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { SendBookingFormButton } from "@/components/shared/send-booking-form-button";
import { RepeatBookingButton } from "@/components/customers/repeat-booking-button";
import { EditCustomerDialog } from "@/components/customers/edit-customer-dialog";
import { ContactMetaDialog } from "@/components/customers/contact-meta-dialog";
import { CustomerSitesCard } from "@/components/customers/customer-sites-card";
import { MybillbookHistoryCard } from "@/components/customers/mybillbook-history-card";
import { parseStoredDetail } from "@/lib/mybillbook-detail";
import { PackageCalculatorButton } from "@/components/layout/package-calculator-dialog";
import { ContactTypeBadge, RepeatBadge } from "@/components/customers/contact-badges";
import { getCustomerHistory } from "@/server/customers";
import { getPartyLedger } from "@/server/party-ledger";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";
import { formatINR, formatDate, formatDateTime } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";

const PARTY_TABS = [["transactions", "Transactions"], ["profile", "Profile"], ["ledger", "Ledger Statement"], ["items", "Item-wise Report"]] as const;

export default async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ mobile: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { mobile } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = PARTY_TABS.find(([k]) => k === tabParam)?.[0] ?? "transactions";
  // Restricted module: explicit page-level guard (Super Admin, Accounts).
  const session = await requireRole(["ADMIN", "ACCOUNTS"]);
  const canEdit = session.role === "ADMIN" || session.role === "ACCOUNTS";
  const { leads, jobs, payments, reviews, master } = await getCustomerHistory(mobile);
  if (leads.length === 0 && jobs.length === 0 && payments.length === 0 && !master) notFound();

  const digits = mobile.replace(/[^\d]/g, "").slice(-10);
  const name = master?.name || leads[0]?.name || jobs[0]?.customerName || "Customer";
  const allPhotos = jobs.flatMap((j) => j.photos);
  const contactType = master?.contactType ?? "CUSTOMER";
  const isRepeat = !!master?.isRepeat || jobs.length > 1 || (jobs.length >= 1 && leads.length >= 1);
  const alternate = master?.alternateMobile ?? leads[0]?.alternateMobile ?? null;
  const email = master?.email ?? leads[0]?.email ?? null;
  const bookingLinks = await db.bookingLink
    .findMany({ where: { customerMobile: digits }, orderBy: { sentAt: "desc" }, take: 10 })
    .catch(() => []);
  const sites = master?.sites ?? [];
  const party = await getPartyLedger(digits);
  // Past MyBillBook invoices attached to this customer (owner 2026-10-23) — one row per invoice number, so never a duplicate.
  const mbbRows = master
    ? await db.mybillbookInvoice
        .findMany({ where: { customerId: master.id }, orderBy: { invoiceDate: "desc" }, take: 100, select: { invoiceKey: true, invoiceNo: true, invoiceDate: true, amount: true, remaining: true, status: true, invoiceLink: true, serviceName: true, jobId: true, detailJson: true, partyAddress: true } })
        .catch(() => [])
    : [];

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
      <div className="grid grid-cols-2 divide-x divide-y rounded-xl border bg-card text-center sm:grid-cols-4 sm:divide-y-0">
        {[
          ["Jobs", String(jobs.length)],
          ["Billed", formatINR(party.ledger.billed)],
          ["Received", formatINR(party.ledger.received)],
          [party.ledger.balance < 0 ? "Advance held" : "To collect", formatINR(Math.abs(party.ledger.balance))],
        ].map(([k, v]) => (
          <div key={k} className="px-1 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">{k}</p>
            <p className={`text-sm font-bold sm:text-base ${k === "To collect" && party.ledger.balance > 0 ? "text-destructive" : ""}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Party tabs (myBillBook style) */}
      <nav aria-label="Party sections" className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1">
        {PARTY_TABS.map(([key, label]) => (
          <Link key={key} href={`/customers/${digits}?tab=${key}`} aria-current={tab === key ? "page" : undefined} className={`min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "transactions" && (
        <div className="space-y-4">
          <section className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase text-muted-foreground">
                <tr><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Reference</th><th className="p-2 text-right">Billed</th><th className="p-2 text-right">Received</th></tr>
              </thead>
              <tbody>
                {party.ledger.rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No transactions yet.</td></tr>}
                {[...party.ledger.rows].reverse().slice(0, 60).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="whitespace-nowrap p-2">{formatDate(r.date)}</td>
                    <td className="p-2">{r.kind}</td>
                    <td className="p-2">{r.ref}{r.note ? <span className="block text-xs text-muted-foreground">{r.note}</span> : null}</td>
                    <td className="p-2 text-right tabular-nums">{r.debit ? formatINR(r.debit) : "—"}</td>
                    <td className="p-2 text-right tabular-nums text-emerald-700">{r.credit ? formatINR(r.credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {jobs.length > 0 && (
            <section className="overflow-x-auto rounded-xl border bg-card">
              <p className="flex items-center gap-2 p-2 text-sm font-semibold"><ClipboardList className="size-4" /> Recent jobs ({jobs.length})</p>
              <table className="w-full text-sm">
                <tbody>
                  {jobs.slice(0, 8).map((job) => (
                    <tr key={job.id} className="border-t">
                      <td className="p-2"><Link href={`/jobs/${job.id}`} className="font-medium text-primary underline-offset-2 hover:underline">{job.jobNumber}</Link></td>
                      <td className="p-2">{SERVICE_LABELS[job.service] ?? job.service}<span className="block text-xs text-muted-foreground">{job.area}</span></td>
                      <td className="whitespace-nowrap p-2">{formatDate(job.scheduledDate)}</td>
                      <td className="p-2 text-right tabular-nums">{formatINR(job.jobValue)}</td>
                      <td className="p-2"><JobStatusBadge status={job.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {payments.length > 0 && (
            <section className="overflow-x-auto rounded-xl border bg-card">
              <p className="flex items-center gap-2 p-2 text-sm font-semibold"><Wallet className="size-4" /> Payment invoices ({payments.length})</p>
              <table className="w-full text-sm">
                <tbody>
                  {payments.slice(0, 8).map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2 font-medium">{p.invoiceNumber}</td>
                      <td className="whitespace-nowrap p-2 text-muted-foreground">Due {formatDate(p.dueDate)}</td>
                      <td className="p-2 text-right tabular-nums">{formatINR(p.amount)}</td>
                      <td className="p-2"><PaymentStatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <MybillbookHistoryCard rows={mbbRows.map(({ detailJson, ...r }) => ({ ...r, jobNumber: r.jobId, detail: parseStoredDetail(detailJson) }))} />
        </div>
      )}

      {tab === "profile" && (
        <div className="space-y-4">
          <section className="grid gap-x-6 gap-y-2 rounded-xl border bg-card p-3 text-sm sm:grid-cols-2">
            {[
              ["Customer ID", master?.customerNumber],
              ["Mobile", digits],
              ["Alternate", alternate],
              ["Email", email],
              ["Type", contactType],
              ["Address", master?.address],
              ["Area", master?.area],
              ["Source", master?.source],
            ].map(([k, v]) => (
              <p key={k as string}><span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{k}</span><span className="font-medium">{v || "—"}</span></p>
            ))}
          </section>

          <CustomerSitesCard
            mobile={digits}
            name={name}
            canEdit={canEdit}
            sites={sites.map((s) => ({ id: s.id, label: s.label, address: s.address, pinCode: s.pinCode, area: s.area, mapLink: s.mapLink, notes: s.notes }))}
          />

          {leads.length > 0 && (
            <section className="overflow-x-auto rounded-xl border bg-card">
              <p className="flex items-center gap-2 p-2 text-sm font-semibold"><MessageSquare className="size-4" /> Recent enquiries ({leads.length})</p>
              <table className="w-full text-sm">
                <tbody>
                  {leads.slice(0, 10).map((lead) => (
                    <tr key={lead.id} className="border-t">
                      <td className="p-2"><Link href={`/leads/${lead.id}`} className="font-medium text-primary underline-offset-2 hover:underline">{lead.leadNumber}</Link></td>
                      <td className="p-2">{SERVICE_LABELS[lead.service] ?? lead.service}</td>
                      <td className="whitespace-nowrap p-2 text-muted-foreground">{formatDate(lead.createdAt)}</td>
                      <td className="p-2"><LeadStageBadge stage={lead.stage} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {reviews.length > 0 && (
            <section className="rounded-xl border bg-card p-3">
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold"><Star className="size-4" /> Reviews ({reviews.length})</p>
              {reviews.map((r) => (
                <p key={r.id} className="text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}{r.comment ? <span className="text-xs text-muted-foreground"> — {r.comment}</span> : null}</p>
              ))}
            </section>
          )}

          {bookingLinks.length > 0 && (
            <section className="rounded-xl border bg-card p-3 text-xs">
              <p className="mb-1 text-sm font-semibold">Links sent ({bookingLinks.length})</p>
              {bookingLinks.map((l) => (
                <p key={l.id} className="flex items-center justify-between gap-2">
                  <span>{l.kind === "REVIEW" ? "Review request" : l.kind === "FOLLOWUP" ? "Follow-up" : "Booking form"} · {formatDateTime(l.sentAt)}</span>
                  <span className="font-semibold">{l.submittedAt ? "Submitted" : l.openedAt ? "Opened" : "Sent"}</span>
                </p>
              ))}
            </section>
          )}

          {master?.serviceHistory && (
            <section className="rounded-xl border bg-card p-3">
              <p className="mb-1 text-sm font-semibold">Imported service history</p>
              <p className="text-xs text-muted-foreground">{master.serviceHistory}</p>
            </section>
          )}
          {allPhotos.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
              {allPhotos.slice(0, 8).map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.url} alt={p.caption ?? p.type} className="aspect-square w-full rounded-md border object-cover" />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "ledger" && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Debit = billed · Credit = received or credited · a positive balance is what {name} owes.</p>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline"><a href={`/api/customers/${digits}/ledger?format=pdf`}><FileText className="size-3.5" /> PDF</a></Button>
              <Button asChild size="sm" variant="outline"><a href={`/api/customers/${digits}/ledger?format=xlsx`}><Download className="size-3.5" /> Excel</a></Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase text-muted-foreground">
                <tr><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Reference</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th className="p-2 text-right">Balance</th></tr>
              </thead>
              <tbody>
                {party.ledger.rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No transactions yet.</td></tr>}
                {party.ledger.rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="whitespace-nowrap p-2">{formatDate(r.date)}</td>
                    <td className="p-2">{r.kind}</td>
                    <td className="p-2">{r.ref}</td>
                    <td className="p-2 text-right tabular-nums">{r.debit ? formatINR(r.debit) : ""}</td>
                    <td className="p-2 text-right tabular-nums text-emerald-700">{r.credit ? formatINR(r.credit) : ""}</td>
                    <td className="p-2 text-right font-medium tabular-nums">{formatINR(Math.abs(r.balance))}{r.balance < 0 ? " Cr" : r.balance > 0 ? " Dr" : ""}</td>
                  </tr>
                ))}
              </tbody>
              {party.ledger.rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 font-semibold"><td className="p-2" colSpan={3}>Total</td><td className="p-2 text-right tabular-nums">{formatINR(party.ledger.billed)}</td><td className="p-2 text-right tabular-nums">{formatINR(party.ledger.received)}</td><td className="p-2 text-right tabular-nums">{formatINR(Math.abs(party.ledger.balance))}{party.ledger.balance < 0 ? " Cr" : party.ledger.balance > 0 ? " Dr" : ""}</td></tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {tab === "items" && (
        <section className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase text-muted-foreground">
              <tr><th className="p-2">Item / service</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Amount</th><th className="p-2 text-right">Invoices</th><th className="p-2">Last</th></tr>
            </thead>
            <tbody>
              {party.items.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No invoice items yet.</td></tr>}
              {party.items.map((i) => (
                <tr key={i.item} className="border-t">
                  <td className="p-2">{i.item}</td>
                  <td className="p-2 text-right tabular-nums">{i.qty}</td>
                  <td className="p-2 text-right tabular-nums">{formatINR(i.amount)}</td>
                  <td className="p-2 text-right tabular-nums">{i.documents}</td>
                  <td className="whitespace-nowrap p-2 text-muted-foreground">{formatDate(i.lastDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
