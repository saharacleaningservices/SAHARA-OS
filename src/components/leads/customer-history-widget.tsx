"use client";

import { Check, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactTypeBadge, RepeatBadge } from "@/components/customers/contact-badges";
import { formatDate, formatINR } from "@/lib/utils";
import type { getRepeatCustomerSummary } from "@/server/actions/customer-actions";

type Summary = NonNullable<Awaited<ReturnType<typeof getRepeatCustomerSummary>>>;

/**
 * Right-side customer history on the New Lead form (owner 2026-10-23): shown as soon as the mobile number matches a customer.
 * Lifetime value (Super Admin / Accounts only), Repeat badge, last service name + date, recent services, notes, and "Use Customer Data".
 */
export function CustomerHistoryWidget({ customer, onUse, canUse }: { customer: Summary; onUse: () => void; canUse: boolean }) {
  const last = customer.recentServices[0];
  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-sm" aria-label="Customer history">
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary"><History className="size-3.5" /> Customer history</p>
        <p className="flex flex-wrap items-center gap-1.5 text-base font-bold">
          {customer.name ?? "Existing customer"}
          <ContactTypeBadge type={customer.contactType} />
          {customer.isRepeat && <RepeatBadge partner={customer.contactType !== "CUSTOMER"} />}
        </p>
        {customer.customerNumber && <p className="text-xs text-muted-foreground">{customer.customerNumber}</p>}
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {customer.lifetimeValue !== null && (
          <div className="rounded-lg bg-background p-2"><dt className="text-[10px] uppercase text-muted-foreground">Lifetime value</dt><dd className="font-bold tabular-nums">{formatINR(customer.lifetimeValue)}</dd></div>
        )}
        <div className="rounded-lg bg-background p-2"><dt className="text-[10px] uppercase text-muted-foreground">Jobs / enquiries</dt><dd className="font-bold">{customer.jobCount} / {customer.leadCount}</dd></div>
        <div className="col-span-2 rounded-lg bg-background p-2">
          <dt className="text-[10px] uppercase text-muted-foreground">Last service</dt>
          <dd className="font-semibold">{last ? last.service : "—"}{last || customer.lastServiceDate ? <span className="block text-xs font-normal text-muted-foreground">{formatDate(last?.date ?? customer.lastServiceDate!)}</span> : null}</dd>
        </div>
      </dl>
      {customer.recentServices.length > 1 && (
        <ul className="space-y-0.5 text-xs">
          {customer.recentServices.slice(1).map((r, i) => (
            <li key={i} className="flex justify-between gap-2"><span className="min-w-0 truncate">{formatDate(r.date)} · {r.service}</span>{r.paid !== null && <span className="tabular-nums">{formatINR(r.paid)}</span>}</li>
          ))}
        </ul>
      )}
      {customer.notes && <p className="whitespace-pre-line rounded-lg bg-background p-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Notes: </span>{customer.notes}</p>}
      {canUse && (
        <Button type="button" size="sm" className="h-9 w-full" onClick={onUse}>
          <Check className="size-3.5" /> Use Customer Data
        </Button>
      )}
    </div>
  );
}
