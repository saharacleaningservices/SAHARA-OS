"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, Calculator, ChevronDown, Link2, Loader2, MessageCircle, Save, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PackageCalculator } from "@/components/shared/package-calculator";
import { ContactTypeBadge, RepeatBadge } from "@/components/customers/contact-badges";
import { EMPTY_PACKAGE, lineAmount, packageTotals, serializeLines, type PackageDraft } from "@/lib/package-calc";
import { attachPackageToLead, getPackageCalculatorAccess, searchCustomersForCalculator, searchLeadsForPackage } from "@/server/actions/package";
import { getRepeatCustomerSummary } from "@/server/actions/customer-actions";
import { createLead } from "@/server/actions/leads";
import { LEAD_SOURCES } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Summary = NonNullable<Awaited<ReturnType<typeof getRepeatCustomerSummary>>>;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const field = "h-10 w-full min-w-0 rounded-md border bg-background px-2 text-sm";
const NEW_SITE = "__new";

/**
 * Package Calculator — compact sales tool (CRM top bar, Customers, customer page).
 * Customer by mobile (reuses the contact + saved sites) → package & services →
 * discount / complimentary → dates → Save as Lead (or attach to an open lead).
 * createLead re-prices everything on the server; quotation and Confirm Booking
 * then run from the lead page, so the package, discount and complimentary
 * items stay on the lead → job → quotation/invoice.
 */
export function PackageCalculatorButton({ prefill, variant = "chip", label = "Package Calculator" }: { prefill?: { mobile?: string; name?: string }; variant?: "chip" | "button"; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<{ canEditPrice: boolean } | null>(null);
  const [pkg, setPkg] = useState<PackageDraft>(EMPTY_PACKAGE);
  const [mobile, setMobile] = useState(prefill?.mobile ?? "");
  const [name, setName] = useState(prefill?.name ?? "");
  const [customer, setCustomer] = useState<Summary | null>(null);
  const [lookedUp, setLookedUp] = useState("");
  const [siteId, setSiteId] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [source, setSource] = useState<(typeof LEAD_SOURCES)[number]>("CALL");
  const [notes, setNotes] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<{ name: string; mobile: string; area: string | null }[]>([]);
  const [results, setResults] = useState<{ id: string; leadNumber: string; name: string; area: string; stage: string }[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open && !access) getPackageCalculatorAccess().then(setAccess).catch(() => {});
  }, [open, access]);

  // Existing customer lookup as soon as a full 10-digit mobile is entered.
  const digits = mobile.replace(/\D/g, "").slice(-10);
  useEffect(() => {
    if (!open || digits.length !== 10 || digits === lookedUp) return;
    setLookedUp(digits);
    getRepeatCustomerSummary(digits)
      .then((s) => {
        setCustomer(s);
        if (s) {
          setName((n) => n || s.name || "");
          setSiteId(s.sites[0]?.id ?? NEW_SITE);
        } else setSiteId(NEW_SITE);
      })
      .catch(() => setCustomer(null));
  }, [open, digits, lookedUp]);

  useEffect(() => {
    if (!showAttach || q.trim().length < 2) return void setResults([]);
    const t = setTimeout(() => searchLeadsForPackage(q).then(setResults).catch(() => setResults([])), 300);
    return () => clearTimeout(t);
  }, [q, showAttach]);

  // Customer search by name (or part of a number) until a full mobile is known.
  useEffect(() => {
    if (!open || digits.length === 10 || name.trim().length < 3 || customer) return void setMatches([]);
    const t = setTimeout(() => searchCustomersForCalculator(name).then(setMatches).catch(() => setMatches([])), 350);
    return () => clearTimeout(t);
  }, [open, name, digits, customer]);

  const total = packageTotals(pkg);
  const ready = pkg.lines.length > 0;
  const site = customer?.sites.find((s) => s.id === siteId);
  const canSave = ready && digits.length === 10 && name.trim().length >= 2;

  function reset() {
    setPkg(EMPTY_PACKAGE);
    setMobile(prefill?.mobile ?? "");
    setName(prefill?.name ?? "");
    setCustomer(null);
    setLookedUp("");
    setSiteId("");
    setAddress("");
    setArea("");
    setServiceDate("");
    setFollowUpDate("");
    setNotes("");
    setShowAttach(false);
    setQ("");
  }

  function saveLead(confirm = false) {
    if (!canSave) return void toast.error(!ready ? "Add at least one service" : "Enter the customer's 10-digit mobile and name");
    start(async () => {
      const res = await createLead({
        name: name.trim(),
        mobile: digits,
        address: site ? site.address : address.trim(),
        area: site ? site.area ?? "" : area.trim(),
        pinCode: site?.pinCode ?? "",
        mapLink: site?.mapLink ?? "",
        siteId: site?.id ?? "",
        service: "HOUSEKEEPING",
        serviceCategory: "CUSTOMIZER_PACKAGE",
        serviceVariant: pkg.lines.length > 1 ? `${pkg.lines[0].name} + ${pkg.lines.length - 1} more` : pkg.lines[0].name,
        serviceItems: serializeLines(pkg),
        discountAmount: total.discount,
        quoteAmount: total.final,
        serviceDate,
        followUpDate,
        source,
        notes: notes.trim(),
      });
      if ("error" in res && res.error) {
        // One open enquiry per mobile: offer to attach to it instead of a duplicate.
        if (/already exists/i.test(res.error)) {
          setShowAttach(true);
          setQ(digits);
        }
        return void toast.error(res.error);
      }
      const qn = "quoteNumber" in res && res.quoteNumber ? ` — quotation ${res.quoteNumber} created` : "";
      toast.success(confirm ? `Lead saved${qn}. Set the date & slot to confirm the booking.` : `Lead saved${qn}. Follow up or confirm from the lead.`);
      setOpen(false);
      reset();
      // Confirmed → the lead opens on Confirm Booking (date, slot, team) → the job keeps these exact values.
      if ("leadId" in res && res.leadId) router.push(`/leads/${res.leadId}${confirm ? "?confirm=1" : ""}`);
    });
  }

  function attach(leadId: string) {
    start(async () => {
      const res = await attachPackageToLead(leadId, serializeLines(pkg), total.discount);
      if ("error" in res && res.error) return void toast.error(res.error);
      if ("leadNumber" in res) toast.success(`Package attached to ${res.leadNumber} — ${inr(res.final ?? 0)}`);
      setOpen(false);
      reset();
      router.push(`/leads/${leadId}`);
    });
  }

  function openFullForm() {
    try {
      sessionStorage.setItem("sahara_pkg_draft", JSON.stringify(pkg));
    } catch {
      /* storage unavailable */
    }
    setOpen(false);
    router.push(digits.length === 10 ? `/leads/new?mobile=${digits}&name=${encodeURIComponent(name.trim())}` : "/leads/new");
  }

  function whatsapp() {
    if (digits.length !== 10) return void toast.error("Enter the customer's 10-digit mobile");
    const lines = pkg.lines.map((l) => `• ${l.name}${l.qty > 1 ? ` × ${l.qty}` : ""} — ${l.complimentary ? `Complimentary (worth ${inr(lineAmount(l))})` : inr(lineAmount(l))}`);
    const text = [
      `Hello ${name.trim() || "there"}, your Sahara Cleaning Services package:`,
      ...lines,
      `Actual value: ${inr(total.subtotal)}`,
      ...(total.discount > 0 ? [`Discount: − ${inr(total.discount)}`] : []),
      ...(total.complimentary > 0 ? [`Complimentary: ${inr(total.complimentary)} (free)`] : []),
      `*Final payable: ${inr(total.final)}*`,
      ...(serviceDate ? [`Preferred date: ${serviceDate}`] : []),
    ].join("\n");
    window.open(`https://wa.me/91${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <>
      {variant === "chip" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40"
        >
          <Calculator className="size-3.5 text-primary" /> <span>{label}</span>
        </button>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Calculator className="size-3.5" /> <span>{label}</span>
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-base"><Calculator className="size-4 text-primary" /> Package Calculator</DialogTitle>
          </DialogHeader>
          {!access ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {/* A. Customer */}
                <section className="space-y-2">
                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
                    <Input type="tel" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile" aria-label="Customer mobile" className="h-10" />
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" aria-label="Customer name" className="h-10" />
                  </div>
                  {matches.length > 0 && (
                    <ul className="divide-y rounded-md border text-sm">
                      {matches.map((m) => (
                        <li key={m.mobile}>
                          <button
                            type="button"
                            onClick={() => {
                              setMobile(m.mobile);
                              setName(m.name);
                              setMatches([]);
                            }}
                            className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-muted/50"
                          >
                            <span className="min-w-0 truncate font-medium">{m.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{m.mobile}{m.area ? ` · ${m.area}` : ""}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {customer && (
                    <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-primary/5 px-2.5 py-1.5 text-xs">
                      <span className="font-semibold">Existing customer</span>
                      <ContactTypeBadge type={customer.contactType} />
                      {customer.isRepeat && <RepeatBadge partner={customer.contactType !== "CUSTOMER"} />}
                      <span className="text-muted-foreground">{customer.jobCount} job{customer.jobCount === 1 ? "" : "s"} · {customer.leadCount} enquir{customer.leadCount === 1 ? "y" : "ies"}</span>
                    </div>
                  )}
                  {digits.length === 10 && (
                    <>
                      {customer && customer.sites.length > 0 && (
                        <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={field} aria-label="Service site">
                          {customer.sites.map((s) => (
                            <option key={s.id} value={s.id}>{s.label ? `${s.label} — ` : ""}{s.address}</option>
                          ))}
                          <option value={NEW_SITE}>+ New site / address</option>
                        </select>
                      )}
                      {!site && (
                        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
                          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" aria-label="Address" className="h-10" />
                          <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area" aria-label="Area" className="h-10" />
                        </div>
                      )}
                    </>
                  )}
                </section>

                {/* B + C. Services, discount, complimentary */}
                <PackageCalculator value={pkg} onChange={setPkg} canEditPrice={access.canEditPrice} />

                {/* D. Follow-up */}
                <details className="group rounded-lg border">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-semibold">
                    <span>Schedule &amp; follow-up {serviceDate || followUpDate ? <span className="font-normal text-muted-foreground">· {[serviceDate && `Service ${serviceDate}`, followUpDate && `Follow-up ${followUpDate}`].filter(Boolean).join(" · ")}</span> : null}</span>
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                    <label className="text-xs text-muted-foreground">Service date<Input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="mt-1 h-10" /></label>
                    <label className="text-xs text-muted-foreground">Follow-up date<Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="mt-1 h-10" /></label>
                    <label className="text-xs text-muted-foreground">Lead source
                      <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={`${field} mt-1 text-foreground`}>
                        {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s === "GMB" ? "Google Business" : s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-muted-foreground">Note<Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" className="mt-1 h-10" /></label>
                  </div>
                </details>

                {showAttach && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-3 size-4 text-muted-foreground" />
                      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Open lead — name, mobile or LD-number" className="h-10 pl-8" />
                    </div>
                    {results.length > 0 ? (
                      <ul className="divide-y rounded-md border text-sm">
                        {results.map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                            <span className="min-w-0 truncate"><span className="font-mono text-xs text-muted-foreground">{r.leadNumber}</span> {r.name} · {r.area}</span>
                            <Button size="sm" variant="outline" disabled={pending || !ready} onClick={() => attach(r.id)}>Attach</Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      q.trim().length >= 2 && <p className="text-xs text-muted-foreground">No open lead found (booked leads can&apos;t take a package — change the job instead).</p>
                    )}
                  </div>
                )}
              </div>

              {/* Sticky actions — thumb reach on mobile */}
              <div className="space-y-2 border-t bg-background px-4 py-3">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Final Payable</span>
                  <span className="text-lg font-extrabold tabular-nums">{inr(total.final)}</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2">
                  <Button type="button" variant="outline" onClick={() => saveLead(false)} disabled={pending || !ready} className="h-10 px-2">
                    {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Lead
                  </Button>
                  <Button type="button" onClick={() => saveLead(true)} disabled={pending || !ready} className="h-10 px-2" title="Save the lead with its quotation, then confirm the booking">
                    <CalendarCheck className="size-4" /> Save &amp; Book
                  </Button>
                  <Button type="button" variant="outline" onClick={whatsapp} disabled={!ready} className="h-10" aria-label="Send summary on WhatsApp">
                    <MessageCircle className="size-4" /><span className="max-sm:hidden">WhatsApp</span>
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAttach((v) => !v)} disabled={!ready} className={cn("h-10", showAttach && "border-primary")} aria-label="Attach to an open lead">
                    <Link2 className="size-4" /><span className="max-sm:hidden">Attach</span>
                  </Button>
                </div>
                <button type="button" onClick={openFullForm} disabled={!ready} className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
                  <UserPlus className="size-3.5" /> Open in full New Lead form
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
