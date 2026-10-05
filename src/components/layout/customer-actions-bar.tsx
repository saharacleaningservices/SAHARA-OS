"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Phone, MessageCircle, Megaphone, UserPlus, X, Search, Loader2, Send } from "lucide-react";
import { toTelLink, toWhatsAppLink } from "@/lib/utils";
import { searchCustomersQuick, bulkSendWhatsAppCampaign } from "@/server/actions/customer-actions";

type Cust = { name: string; mobile: string; leadId?: string };
type Intent = "CALL" | "WHATSAPP" | "OFFER";

/**
 * Top action bar, sitting just under the Topbar on every authenticated
 * page — replaces the old floating bottom-right "Customer Actions" button
 * (owner instruction 2026-09-21: the FAB covered content and was easy to
 * miss; a fixed top bar with the five most common actions is always
 * visible instead). Booking Form / Payment Link / Gallery / Review link
 * sending (the FAB's old extra actions) already live contextually on the
 * Lead/Job/Customer detail pages via SendBookingFormButton, so nothing is
 * lost by trimming this bar down to exactly what was asked for.
 */
export function CustomerActionsBar() {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Cust[]>([]);
  const [picked, setPicked] = useState<Cust | null>(null);
  const [offerMessage, setOfferMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!intent || picked) return;
    const t = setTimeout(() => {
      startTransition(async () => setRows(await searchCustomersQuick(q)));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, intent, picked]);

  function reset() {
    setIntent(null);
    setPicked(null);
    setQ("");
    setRows([]);
    setOfferMessage("");
  }

  function pick(c: Cust) {
    if (intent === "CALL") {
      window.location.href = toTelLink(c.mobile);
      reset();
      return;
    }
    if (intent === "WHATSAPP") {
      window.open(toWhatsAppLink(c.mobile), "_blank", "noopener");
      reset();
      return;
    }
    setPicked(c);
    setOfferMessage(`Hi {name}, `);
  }

  function sendOffer() {
    if (!picked || !offerMessage.trim()) return;
    startTransition(async () => {
      const res = await bulkSendWhatsAppCampaign([{ name: picked.name, mobile: picked.mobile }], offerMessage);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(res.sent > 0 ? "Offer sent" : "Offer queued (WhatsApp not connected yet)");
      reset();
    });
  }

  const QUICK_ACTIONS = [
    { key: "CALL" as const, label: "Call", icon: Phone },
    { key: "WHATSAPP" as const, label: "WhatsApp", icon: MessageCircle },
    { key: "OFFER" as const, label: "Send Offer", icon: Megaphone },
  ];

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-card/60 px-4 py-2 sm:px-6">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setIntent(a.key)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40"
          >
            <a.icon className="size-3.5 text-primary" /> {a.label}
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
        <Link
          href="/leads/new"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40"
        >
          <UserPlus className="size-3.5 text-primary" /> New Lead
        </Link>
      </div>

      {intent && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20 sm:pt-24" onClick={reset}>
          <div
            className="max-h-[75vh] w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {picked ? picked.name : intent === "CALL" ? "Call a customer" : intent === "WHATSAPP" ? "WhatsApp a customer" : "Send an offer"}
              </p>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
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
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto size-4 animate-spin" />
                    </p>
                  ) : rows.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">{q ? "No matches" : "Type to search customers"}</p>
                  ) : (
                    rows.map((c) => (
                      <button
                        key={c.mobile}
                        onClick={() => pick(c)}
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
              <div className="space-y-3 p-3">
                <textarea
                  autoFocus
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
                  placeholder="Hi {name}, ..."
                />
                <p className="text-xs text-muted-foreground">Use {"{name}"} to personalize the message.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPicked(null)}
                    className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={sendOffer}
                    disabled={pending || !offerMessage.trim()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
