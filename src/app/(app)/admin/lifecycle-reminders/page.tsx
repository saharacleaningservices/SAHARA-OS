import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";
import { whatsappOutboundMode } from "@/lib/whatsapp";
import { collectPayments, collectRebook, remindersEnabled } from "@/server/lifecycle-reminders";
import { LifecycleRemindersPanel } from "@/components/settings/lifecycle-reminders-panel";
import { milestoneLabel } from "@/lib/lifecycle-reminders";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lifecycle Reminders — Sahara OS" };

// Re-booking reminders (6 / 12 months after a deep clean) and overdue B2B payment follow-ups. Super Admin only. Nothing is sent unless
// WHATSAPP_REMINDERS=on and the outbound mode allows it; the lists below are what the next sweep would send.
export default async function LifecycleRemindersPage() {
  await requireRole(["ADMIN"]);
  const [rebook, pay, recent] = await Promise.all([
    collectRebook(),
    collectPayments(),
    db.reminderLog.findMany({ where: { kind: { in: ["REBOOK", "PAYMENT"] } }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const mode = whatsappOutboundMode();
  return (
    <div className="space-y-4">
      <PageHeader title="Lifecycle Reminders" description="Re-booking reminders 6 and 12 months after a deep-cleaning service, and friendly follow-ups for overdue GST / corporate invoices." />
      <div className="rounded-xl border p-4 text-sm">
        <p>
          Outbound mode: <b>{mode}</b> · Reminders switch (<code>WHATSAPP_REMINDERS</code>): <b>{remindersEnabled() ? "ON" : "OFF"}</b>
        </p>
        <p className="mt-1 text-muted-foreground">
          Template-only. Overdue invoices are followed up automatically only until 90 days past their due date; older debts are left for a personal call. Re-booking goes to contacts with a recorded WhatsApp opt-in only; anyone who opted out is skipped; each milestone is sent once; sending happens 10:00–18:00 IST, at most 30 per sweep. In TEST mode only the approved test number can receive anything. Both templates must be submitted to Meta and approved first (WhatsApp Log → Submit to Meta).
        </p>
        <div className="mt-3">
          <LifecycleRemindersPanel enabled={remindersEnabled()} />
        </div>
      </div>

      <section className="space-y-1">
        <h2 className="text-sm font-semibold">Re-booking reminders due now ({rebook.length})</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Customer</th><th className="p-2">Last service</th><th className="p-2">Date</th><th className="p-2">Reminder</th></tr></thead>
            <tbody>
              {rebook.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Nobody is due (or nobody due has a recorded opt-in).</td></tr>}
              {rebook.map((r) => (
                <tr key={r.key} className="border-t"><td className="p-2">{r.name}</td><td className="p-2">{r.service}</td><td className="p-2">{formatDate(r.lastService)}</td><td className="p-2">{milestoneLabel(r.milestone)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-1">
        <h2 className="text-sm font-semibold">Overdue GST / corporate payments to follow up ({pay.length})</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Party</th><th className="p-2">Invoice</th><th className="p-2 text-right">Balance</th><th className="p-2">Due</th><th className="p-2">Follow-up</th></tr></thead>
            <tbody>
              {pay.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">No overdue GST invoice needs a follow-up.</td></tr>}
              {pay.map((p) => (
                <tr key={p.key} className="border-t"><td className="p-2">{p.party}</td><td className="p-2">{p.invoiceNo}</td><td className="p-2 text-right tabular-nums">{formatINR(p.remaining)}</td><td className="p-2">{formatDate(p.due)}</td><td className="p-2">#{p.number} of 3</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold">Recently sent</h2>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {recent.map((r) => (
              <li key={r.id}>{formatDateTime(r.createdAt)} · {r.kind} · {r.status} · {r.dedupeKey}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
