"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import {
  Users,
  X,
  Search,
  Loader2,
  Send,
  Star,
  MessageCircle,
  MessageSquare,
  Phone,
  Copy,
  IndianRupee,
  Images,
} from "lucide-react";
import { toTelLink, toWhatsAppLink } from "@/lib/utils";
import { searchCustomersQuick, sendCustomerSMS } from "@/server/actions/customer-actions";
import { createBookingLink } from "@/server/actions/booking-links";

type Cust = { name: string; mobile: string; leadId?: string };

export function CustomerActionsFab() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Cust[]>([]);
  const [picked, setPicked] = useState<Cust | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      startTransition(async () => setRows(await searchCustomersQuick(q)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  function reset() {
    setOpen(false);
    setPicked(null);
    setQ("");
    setRows([]);
  }

  function act(kind: "BOOKING_FORM" | "REVIEW" | "PAYMENT" | "GALLERY") {
    if (!picked) return;
    startTransition(async () => {
      const r = await createBookingLink({ kind, name: picked.name, mobile: picked.mobile, leadId: picked.leadId });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      window.open(r.waUrl, "_blank", "noopener");
      const msg: Record<typeof kind, string> = {
        BOOKING_FORM: "Booking form link created",
        REVIEW: "Review link created",
        PAYMENT: "Payment link created",
        GALLERY: "Gallery link created",
      };
      toast.success(msg[kind]);
    });
  }

  function sms() {
    if (!picked) return;
    startTransition(async () => {
      const r = await sendCustomerSMS(picked.mobile, picked.name, `Hi ${picked.name}, this is Sahara Cleaning Services. How can we help you today?`);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success("SMS queued");
    });
  }

  async function copyLink() {
    if (!picked) return;
    const url = `https://app.saharacleaningservices.com/book?customer=${encodeURIComponent(picked.name)}&phone=${picked.mobile}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Booking link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  }

  const ACTIONS = picked
    ? [
        { label: "Send Booking Form", icon: Send, run: () => act("BOOKING_FORM") },
        { label: "Send Google Review Link", icon: Star, run: () => act("REVIEW") },
        { label: "Send Payment Link", icon: IndianRupee, run: () => act("PAYMENT") },
        { label: "Send Before/After Gallery", icon: Images, run: () => act("GALLERY") },
        { label: "WhatsApp Customer", icon: MessageCircle, href: toWhatsAppLink(picked.mobile) },
        { label: "SMS Customer", icon: MessageSquare, run: sms },
        { label: "Call Customer", icon: Phone, href: toTelLink(picked.mobile) },
        { label: "Copy Booking Link", icon: Copy, run: copyLink },
      ]
    : [];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl transition hover:scale-105"
      >
        <Users className="size-4" /> Customer Actions
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={reset}>
          <div
            className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {picked ? picked.name : "Customer Actions"}
              </p>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>

            {!picked ? (
              <div className="p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name or mobile…"
                    className="w-full rounded-lg border border-border bg-background px-9 py-2 text-sm"
                  />
                </div>
                <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                  {pending && rows.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto size-4 animate-spin" /></p>
                  ) : rows.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">{q ? "No matches" : "Type to search customers"}</p>
                  ) : (
                    rows.map((c) => (
                      <button
                        key={c.mobile}
                        onClick={() => setPicked(c)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-left text-sm hover:border-primary/40"
                      >
                        <span className="min-w-0 truncate font-medium text-foreground">{c.name || "Customer"}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{c.mobile}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 p-3">
                {ACTIONS.map((a) =>
                  a.href ? (
                    <a
                      key={a.label}
                      href={a.href}
                      target={a.href.startsWith("http") ? "_blank" : undefined}
                      rel="noreferrer"
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-center text-xs font-medium text-foreground hover:border-primary/40"
                    >
                      <a.icon className="size-5 text-primary" /> {a.label}
                    </a>
                  ) : (
                    <button
                      key={a.label}
                      onClick={a.run}
                      disabled={pending}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-center text-xs font-medium text-foreground hover:border-primary/40 disabled:opacity-50"
                    >
                      <a.icon className="size-5 text-primary" /> {a.label}
                    </button>
                  ),
                )}
                <button onClick={() => setPicked(null)} className="col-span-2 mt-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                  ← Pick a different customer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
