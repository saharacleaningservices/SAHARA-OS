"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarCheck, CheckCircle2, Clock, MapPin, MessageCircle, Minus, Phone, Plus, ShieldCheck, X } from "lucide-react";
import type { LeadIntent } from "@/components/public/bhk-price-cards";
import { trackFunnel, trackLead } from "@/components/public/marketing-tags";
import { getAttributionPayload } from "@/components/public/attribution-capture";
import { getDateAvailability, getSlotAvailability } from "@/server/actions/slot-availability";
import { publicBookLead } from "@/server/actions/public-booking";
import { getQuickAddOns } from "@/server/actions/public-addons";
import { captureCheckoutLead, confirmAdvancePayment, getBookingFlowConfig, sendBookingOtp, startAdvanceCheckout, verifyBookingOtp, type BookingFlowConfig, type SavedSite, type VerifiedCustomer } from "@/server/actions/booking-checkout";
import { LOCALITIES } from "@/config/pune-seo-matrix";
import { MOQ_VALUE, ZONE_B_MOV_MESSAGE, detectAreaFromAddress, localitySlug, moqFor, normalizePincode, upgradeBundle, type AddOn } from "@/lib/zonal-moq";
import { addOnSlotsFor, type AddOnSlot } from "@/lib/booking-addons";
import { slotDisplay, slotsForCategory } from "@/lib/booking-slots";
import { paymentSplit } from "@/lib/booking-payment";
import { TRUST } from "@/lib/booking-target";

/**
 * Website booking flow (owner directive 2026-11-12), Urban Company style, 5 steps for every fixed-price booking:
 *   1 Package + "Add Extra Services (Optional)" + live bill breakup (before any login)
 *   2 Mobile number → OTP verification (logs the verified number into the CRM as an abandoned-checkout lead)
 *   3 Returning customer: name + saved addresses (radio) + "Add another address"; new customer: name + ONE full-address box + GPS
 *   4 Date + time slot — Full House / Home Deep Cleaning shows only the three 8 AM – 2 PM arrival windows
 *   5 20% online advance (Razorpay) to confirm; 80% payable after service; trust badge, cancellation policy, callback link
 * OTP and the advance are switched on by server config (booking-checkout.ts): with no SMS gateway / Razorpay keys the steps are
 * skipped and the booking behaves as before. Mounted by LeadModal (quick-booking-modal.tsx) for fixed-price intents only.
 */

type DayInfo = { date: string; available: boolean; status: "AVAILABLE" | "FILLING" | "FULL" };
type SlotInfo = { slot: string; available: boolean };
type Done = { kind: "confirmed" | "received"; id: string; slotText: string; total: number; advance: number };

const STEPS = ["Package", "Mobile", "Details", "Date & time", "Confirm"] as const;
const WEST_PCMC = LOCALITIES.filter((l) => l.zone === "west-pcmc").map((l) => l.slug);
const FALLBACK_SLOTS = ["8:00 – 10:00 AM", "10:00 AM – 12:00 PM", "12:00 – 2:00 PM", "2:00 – 4:00 PM", "4:00 – 6:00 PM"].map((slot) => ({ slot, available: true }));
const inr = (n: number) => (Number.isInteger(n) ? `₹${n.toLocaleString("en-IN")}` : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const istToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const dayLabel = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00+05:30`);
  return { wd: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }), dm: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) };
};
const TONE = { AVAILABLE: "bg-emerald-50 text-emerald-800 ring-emerald-200", FILLING: "bg-orange-50 text-orange-800 ring-orange-200", FULL: "bg-red-50 text-red-400 ring-red-100" } as const;
const DOT = { AVAILABLE: "bg-emerald-500", FILLING: "bg-orange-500", FULL: "bg-red-500" } as const;
const STATUS_TEXT = { AVAILABLE: "Available", FILLING: "Filling fast", FULL: "Fully booked" } as const;

type RzpResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RzpCtor = new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: () => void) => void };
declare global { interface Window { Razorpay?: RzpCtor } }
function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export function BookingFlow({ intent, waNumber, onClose }: { intent: LeadIntent; waNumber: string; onClose: () => void }) {
  const category = intent.category!;
  const [cfg, setCfg] = useState<BookingFlowConfig | null>(null);
  const [step, setStep] = useState(1);
  const [pool, setPool] = useState<AddOn[]>([]);
  const [extras, setExtras] = useState<AddOn[]>([]);
  // step 2
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [token, setToken] = useState("");
  const [customer, setCustomer] = useState<VerifiedCustomer>(null);
  const [busy, setBusy] = useState(false);
  // step 3
  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState<string>("new");
  const [address, setAddress] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "locating" | "denied">("idle");
  const [notes, setNotes] = useState("");
  // step 4
  const [days, setDays] = useState<DayInfo[] | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [slot, setSlot] = useState("");
  // step 5
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [callback, setCallback] = useState<"idle" | "sending" | "sent">("idle");
  const held = useRef<{ leadId: string; total: number } | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const [vh, setVh] = useState<number | null>(null);

  const label = intent.pkg ? `${intent.service} · ${intent.pkg}` : intent.service;
  const priced = (intent.price ?? 0) > 0;
  const mobile10 = mobile.replace(/\D/g, "").slice(-10);
  const savedSites: SavedSite[] = customer?.sites ?? [];
  const site = savedSites.find((s) => s.id === siteId) ?? null;
  const usingNew = !site;

  useEffect(() => {
    let alive = true;
    getBookingFlowConfig().then((c) => alive && setCfg(c)).catch(() => alive && setCfg({ otp: false, advance: false }));
    getQuickAddOns().then((a) => alive && setPool(a)).catch(() => {});
    getDateAvailability(30).then((d) => { if (!alive) return; setDays(d); setDate((cur) => cur || d.find((x) => x.available)?.date || ""); }).catch(() => alive && setDays([]));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    const vv = window.visualViewport;
    const onVv = () => vv && setVh(Math.round(vv.height));
    onVv();
    vv?.addEventListener("resize", onVv);
    return () => { alive = false; document.body.style.overflow = prev; window.removeEventListener("keydown", esc); vv?.removeEventListener("resize", onVv); };
  }, [onClose]);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    setSlots(null);
    getSlotAvailability(date)
      .then((r) => alive && setSlots(r.ok ? r.slots : FALLBACK_SLOTS))
      .catch(() => alive && setSlots(FALLBACK_SLOTS));
    return () => { alive = false; };
  }, [date]);

  // ── money ──
  const extrasTotal = extras.reduce((t, x) => t + x.price * x.minQty, 0);
  const subtotal = (intent.price ?? 0) + extrasTotal;
  const split = paymentSplit(subtotal);
  const advanceOn = !!cfg?.advance && priced;

  // ── add-on chips for this category ──
  const basket = [...(intent.items ?? []).map((i) => i.contentId), ...extras.map((x) => x.contentId)];
  const chips = addOnSlotsFor(intent)
    // "Removing & Placing Back" is already part of the utensil-removal kitchen package.
    .filter((slot) => !(slot.contentId === "SCS-39" && basket.includes("SCS-33")))
    .map((slot) => ({ slot, add: pool.find((p) => p.contentId === slot.contentId) }))
    .filter((c): c is { slot: AddOnSlot; add: AddOn } => !!c.add && (!basket.includes(c.slot.contentId) || extras.some((x) => x.contentId === c.slot.contentId)));
  const setQty = (id: string, q: number, min: number) => setExtras((cur) => cur.map((x) => (x.contentId === id ? { ...x, minQty: Math.min(50, Math.max(min, q)) } : x)));
  const toggle = (a: AddOn, lbl: string) => {
    if (!extras.some((x) => x.contentId === a.contentId)) trackFunnel("select_addon", { service: category, item: lbl, value: a.price * a.minQty });
    setExtras((cur) => (cur.some((x) => x.contentId === a.contentId) ? cur.filter((x) => x.contentId !== a.contentId) : [...cur, a]));
  };

  // ── zone (from the single address box, a saved site, or GPS) ──
  const det = useMemo(() => detectAreaFromAddress(usingNew ? address : site!.address, LOCALITIES), [address, site, usingNew]);
  const pincode = normalizePincode(det.pincode || site?.pinCode || "");
  const locality = det.locality || localitySlug(site?.area);
  const moqApplies = priced && category !== "PEST_CONTROL";
  const moq = moqApplies ? moqFor({ locality, pincode: pincode.length === 6 ? pincode : "", gps }, WEST_PCMC).moq : 0;
  const gap = moq > 0 ? Math.max(0, moq - subtotal) : 0;
  const upgrade = gap > 0 ? upgradeBundle(gap, addOnSlotsFor(intent).map((s) => pool.find((p) => p.contentId === s.contentId)).filter((p): p is AddOn => !!p), basket).concat([]) : [];
  const upgradeFallback = gap > 0 && upgrade.length === 0 ? upgradeBundle(gap, pool, basket) : [];

  const visibleSlots = slots ? slotsForCategory(category, slots) : null;
  const slotText = date ? `${dayLabel(date).wd}, ${dayLabel(date).dm}${slot ? ` · ${slotDisplay(slot)}` : ""}` : "";

  function locate() {
    if (!("geolocation" in navigator)) return setGpsState("denied");
    setGpsState("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => { setGps({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), acc: Math.round(p.coords.accuracy) }); setGpsState("idle"); },
      () => setGpsState("denied"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  // ── step 2: mobile / OTP ──
  async function sendOtp() {
    setError("");
    if (!/^[6-9]\d{9}$/.test(mobile10)) return setError("Please enter a valid 10-digit mobile number.");
    setBusy(true);
    const r = await sendBookingOtp(mobile10).catch(() => ({ ok: false as const, error: "No connection. Please try again." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOtpSent(true);
    if (r.devCode) setDevCode(r.devCode);
  }
  async function verifyOtp() {
    setError("");
    setBusy(true);
    const r = await verifyBookingOtp(mobile10, otp).catch(() => ({ ok: false as const, error: "No connection. Please try again." }));
    if (!r.ok) { setBusy(false); return setError(r.error); }
    setToken(r.token);
    setCustomer(r.customer);
    if (r.customer) { setName(r.customer.name); setSiteId(r.customer.sites[0]?.id ?? "new"); }
    // Abandoned-checkout capture: the verified number is in the CRM from this moment.
    void captureCheckoutLead({ mobile: mobile10, otpToken: r.token, category, service: intent.service, packageName: intent.packageName ?? intent.pkg, amount: subtotal, name: r.customer?.name });
    trackFunnel("verify_mobile", { service: category });
    setBusy(false);
    setStep(3);
  }
  function continueFromMobile() {
    setError("");
    if (!/^[6-9]\d{9}$/.test(mobile10)) return setError("Please enter a valid 10-digit mobile number.");
    setStep(3);
  }

  // ── navigation guards ──
  function next() {
    setError("");
    if (step === 3) {
      if (name.trim().length < 2) return setError("Please enter your name.");
      if (usingNew && address.trim().length < 8) return setError("Please enter your full address — flat, building, area and landmark.");
      if (gap > 0) return setError(`${ZONE_B_MOV_MESSAGE} Add ${inr(gap)} more.`);
    }
    if (step === 4) {
      if (!date) return setError("Please choose your preferred date.");
      if (!slot) return setError("Please choose a time slot.");
    }
    setStep((s) => Math.min(5, s + 1));
  }

  // ── step 5: book / pay ──
  async function bookAndPay() {
    setError("");
    if (honeypot.current?.value) return;
    setBusy(true);
    try {
      const addr = usingNew ? address.trim() : site!.address;
      const mapsUrl = site?.mapLink || (gps ? `https://maps.google.com/?q=${gps.lat},${gps.lng}` : "");
      const area = (det.localityName || site?.area || addr.split(/[\n,]/)[0]!.trim() || "Pune").slice(0, 100);
      const hold = advanceOn;
      let leadId = held.current?.leadId ?? "";
      let total = held.current?.total ?? subtotal;
      let status: "CONFIRMED" | "PENDING" = "PENDING";
      let ref = "";
      if (!leadId) {
        const r = await publicBookLead({
          name: name.trim(), mobile: mobile10, website: honeypot.current?.value ?? "",
          area, address: [addr, gps && !site ? `GPS ${gps.lat},${gps.lng}` : ""].filter(Boolean).join(" · ").slice(0, 400),
          pinCode: pincode.length === 6 ? pincode : "", mapLink: mapsUrl,
          serviceCategory: category, serviceVariant: intent.service.slice(0, 120), propertyType: intent.propertyType ?? "",
          packageName: `${intent.packageName ?? intent.pkg ?? ""}${extras.length ? ` + ${extras.map((x) => x.name).join(" + ")}` : ""}`.slice(0, 120),
          selectedItems: [...(intent.items ?? []), ...extras.map((x) => ({ contentId: x.contentId, qty: x.minQty }))],
          estimatedAmount: subtotal || undefined,
          serviceDate: date, timeSlot: slot,
          notes: [`Website booking flow — ${label}${extras.length ? ` + ${extras.map((x) => x.name).join(" + ")}` : ""}${subtotal ? ` · shown total ${inr(subtotal)}` : ""}`, notes && `Customer notes: ${notes}`].filter(Boolean).join("\n").slice(0, 2000),
          source: "", attribution: getAttributionPayload(),
          otpToken: token || undefined, holdForAdvance: hold || undefined,
        });
        if ("error" in r && r.error) { setBusy(false); return setError(r.error); }
        const ok = r as { leadId?: string; leadNumber?: string; quoteAmount?: number | null; status?: "CONFIRMED" | "PENDING"; jobNumber?: string };
        leadId = ok.leadId ?? "";
        total = ok.quoteAmount ?? subtotal;
        status = ok.status ?? "PENDING";
        ref = (status === "CONFIRMED" ? ok.jobNumber : ok.leadNumber) || ok.leadNumber || "";
        if (hold && leadId) held.current = { leadId, total };
      }
      if (!hold || !leadId) {
        finish({ kind: status === "CONFIRMED" ? "confirmed" : "received", id: ref, slotText, total, advance: 0 }, status === "CONFIRMED");
        return;
      }
      const start = await startAdvanceCheckout({ leadId, mobile: mobile10 });
      if (!start.ok) { setBusy(false); return setError(start.error); }
      if (!(await loadRazorpay()) || !window.Razorpay) { setBusy(false); return setError("Payment window could not load — check your connection and try again."); }
      const rzp = new window.Razorpay({
        key: start.keyId, amount: start.amountPaise, currency: "INR", order_id: start.orderId,
        name: "Sahara Cleaning Services", description: `20% advance · ${label}`,
        prefill: { name: name.trim(), contact: mobile10 }, theme: { color: "#0b5ed7" },
        modal: { ondismiss: () => { setBusy(false); setError("Payment not completed. Your slot is on hold for a short time — tap Pay again to finish, or call us."); } },
        handler: async (resp: RzpResponse) => {
          setBusy(true);
          const c = await confirmAdvancePayment({ leadId, orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature }).catch(() => null);
          if (!c || !c.ok) { setBusy(false); return setError(c && !c.ok ? c.error : "We could not confirm the payment yet. If money was deducted it is safe — please call us."); }
          finish({ kind: c.status === "CONFIRMED" ? "confirmed" : "received", id: c.jobNumber || c.leadNumber, slotText, total: c.total, advance: c.advance }, c.status === "CONFIRMED");
        },
      });
      rzp.on("payment.failed", () => { setBusy(false); setError("Payment failed — no money was taken. Please try again or use another method."); });
      rzp.open();
    } catch {
      setBusy(false);
      setError("No connection. Please try again, or call us.");
    }
  }
  function finish(d: Done, confirmed: boolean) {
    setBusy(false);
    setDone(d);
    trackLead({ category, variant: intent.pkg, mobile: mobile10, value: subtotal || undefined, id: d.id, kind: "booking", confirmed });
    trackFunnel("booking_confirmation", { service: category, value: subtotal || undefined });
  }

  async function requestCallback() {
    setCallback("sending");
    const p = getAttributionPayload();
    const t = p.first ?? p.latest ?? null;
    try {
      await fetch("/api/leads/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Website visitor", mobile: mobile10, website: "", service: intent.service, location: (usingNew ? address : site?.address) || "", source: "",
          preferredDate: date, preferredSlot: slot,
          message: `Callback requested from the booking flow (step ${step}) — ${label}${subtotal ? ` · ${inr(subtotal)}` : ""}. Needs help or a custom quote.`,
          utm_source: t?.source ?? "", utm_medium: t?.medium ?? "", utm_campaign: t?.campaign ?? "", landing_page_url: t?.landingPageUrl ?? window.location.href.slice(0, 500),
        }),
      });
      setCallback("sent");
    } catch { setCallback("idle"); setError("Couldn't send. Please call or WhatsApp us."); }
  }

  const input = "min-h-12 w-full rounded-2xl border-2 border-[#0a2540]/10 bg-white px-3.5 text-base text-[#0a2540] outline-none transition focus:border-primary";
  const btn = "min-h-14 w-full rounded-2xl bg-gradient-to-r from-[#0b5ed7] to-[#0a2540] text-base font-extrabold text-white shadow-lg disabled:opacity-60";
  const canGoBack = step > 1 && !held.current && !done;

  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex h-[100dvh] items-end justify-center bg-[#0a2540]/60 sm:items-center sm:p-4" style={vh ? { height: vh } : undefined} role="dialog" aria-modal="true" aria-labelledby="flow-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-[#f5f8fd] text-[#0a2540] shadow-2xl sm:max-h-[92vh] sm:max-w-lg sm:rounded-[28px]">
        <div className={`px-5 pb-3 pt-4 text-white ${done?.kind === "confirmed" ? "bg-gradient-to-br from-emerald-500 to-emerald-700" : "bg-gradient-to-br from-[#0b5ed7] to-[#0a2540]"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {canGoBack && <button type="button" onClick={() => { setError(""); setStep((s) => s - 1); }} aria-label="Back" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"><ArrowLeft className="size-5" /></button>}
              <div className="min-w-0">
                <h2 id="flow-title" className="truncate text-lg font-extrabold">{done ? (done.kind === "confirmed" ? "Your Booking Has Been Confirmed!" : "Booking Received!") : STEPS[step - 1]}</h2>
                <p className="truncate text-xs text-white/85">{label}{intent.price ? ` · ${inr(intent.price)}` : ""}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"><X className="size-5" /></button>
          </div>
          {!done && (
            <div className="mt-3" aria-label={`Step ${step} of 5`}>
              <div className="flex gap-1.5">{STEPS.map((s, n) => <span key={s} className={`h-1.5 flex-1 rounded-full ${n < step ? "bg-white" : "bg-white/30"}`} />)}</div>
              <p className="mt-1 text-[11px] font-semibold text-white/80">Step {step} of 5</p>
            </div>
          )}
        </div>

        <div className="overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {done ? (
            <div className="py-2 text-center" role="status">
              <CheckCircle2 className={`mx-auto size-14 ${done.kind === "confirmed" ? "text-emerald-600" : "text-primary"}`} />
              <dl className="mt-3 space-y-2 rounded-3xl bg-white p-4 text-left text-sm shadow-sm">
                {done.id && <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">{done.kind === "confirmed" ? "Booking ID" : "Request ID"}</dt><dd className="font-extrabold">{done.id}</dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">Service</dt><dd className="text-right font-semibold">{label}</dd></div>
                {done.slotText && <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">Slot</dt><dd className="text-right font-semibold">{done.slotText}</dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">Total</dt><dd className="font-extrabold">{inr(done.total)}</dd></div>
                {done.advance > 0 && <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">Advance paid</dt><dd className="font-extrabold text-emerald-700">{inr(done.advance)}</dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">Payable after service</dt><dd className="font-extrabold">{inr(Math.max(0, done.total - done.advance))}</dd></div>
              </dl>
              <p className="mt-3 text-sm font-semibold text-[#0a2540]/80">{done.kind === "confirmed" ? "Our team details and arrival updates will follow on WhatsApp." : "Your request is in our system — our team confirms the slot shortly on a call / WhatsApp."}</p>
              {done.kind === "confirmed" && <p className="mt-2 text-xs text-[#0a2540]/60">Track it anytime at <a href="/track" className="font-bold text-primary">saharacleaningservices.com/track</a></p>}
              <a href={`https://wa.me/91${waNumber}?text=${encodeURIComponent(`Hi Sahara, my booking ${done.id} — ${label}${done.slotText ? `, ${done.slotText}` : ""}.`)}`} target="_blank" rel="noreferrer" className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-sm font-extrabold text-white shadow-md"><MessageCircle className="size-5" /> Chat on WhatsApp for Instant Updates</a>
            </div>
          ) : (
            <div className="space-y-4">
              {/* ── STEP 1 ── */}
              {step === 1 && (
                <>
                  <section className="rounded-3xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-primary">Your package</p>
                    <p className="mt-1 font-extrabold">{label}</p>
                    {intent.propertyType && <p className="text-xs text-[#0a2540]/60">{intent.propertyType}</p>}
                  </section>
                  {chips.length > 0 && (
                    <section className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-sm font-bold">Add Extra Services <span className="font-normal text-[#0a2540]/55">(Optional)</span></p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {chips.map(({ slot: s, add }) => {
                          const cur = extras.find((x) => x.contentId === add.contentId);
                          const on = !!cur;
                          const q = cur?.minQty ?? add.minQty;
                          return (
                            <div key={add.contentId} className="flex flex-wrap items-center gap-2">
                              <button type="button" aria-pressed={on} onClick={() => toggle(add, s.label)} className={`min-h-10 rounded-full border-2 px-3 text-xs font-extrabold transition ${on ? "border-primary bg-primary text-white" : "border-[#0a2540]/10 bg-white text-[#0a2540] hover:border-primary/50"}`}>
                                {on ? "✓ " : "+ "}{s.label} {s.perUnit ? `${inr(add.price)} per ${add.name.toLowerCase().includes("mattress") ? "mattress" : "seat"}` : inr(add.price * add.minQty)}
                              </button>
                              {on && s.perUnit && (
                                <div className="flex items-center gap-1 rounded-xl bg-[#eef4fb] p-1 ring-1 ring-[#0a2540]/10" role="group" aria-label={`Quantity for ${s.label}`}>
                                  <button type="button" aria-label="Decrease" disabled={q <= add.minQty} onClick={() => setQty(add.contentId, q - 1, add.minQty)} className="flex size-9 items-center justify-center rounded-lg bg-white disabled:opacity-30"><Minus className="size-4" /></button>
                                  <span className="w-8 text-center text-sm font-extrabold tabular-nums" aria-live="polite">{q}</span>
                                  <button type="button" aria-label="Increase" disabled={q >= 50} onClick={() => setQty(add.contentId, q + 1, add.minQty)} className="flex size-9 items-center justify-center rounded-lg bg-white disabled:opacity-30"><Plus className="size-4" /></button>
                                  <span className="px-1.5 text-xs font-extrabold text-[#0a2540]/70">= {inr(add.price * q)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  <section className="rounded-3xl bg-white p-4 shadow-sm" aria-live="polite">
                    <p className="text-sm font-bold">Bill details</p>
                    <dl className="mt-2 space-y-1.5 text-sm">
                      <div className="flex justify-between gap-3"><dt>{intent.packageName ?? intent.pkg ?? intent.service}</dt><dd className="font-semibold">{priced ? inr(intent.price!) : "—"}</dd></div>
                      {extras.map((x) => <div key={x.contentId} className="flex justify-between gap-3"><dt>+ {x.name.replace(" (add-on)", "")}{x.minQty > 1 ? ` (${x.minQty} × ${inr(x.price)})` : ""}</dt><dd className="font-semibold">{inr(x.price * x.minQty)}</dd></div>)}
                      <div className="flex justify-between gap-3 border-t border-[#0a2540]/10 pt-2 text-base"><dt className="font-extrabold">Total</dt><dd className="font-extrabold">{inr(subtotal)}</dd></div>
                      {advanceOn && (
                        <>
                          <div className="flex justify-between gap-3 text-emerald-700"><dt>Pay now to confirm ({split.percent}% advance)</dt><dd className="font-extrabold">{inr(split.advance)}</dd></div>
                          <div className="flex justify-between gap-3 text-[#0a2540]/70"><dt>Payable after service completion</dt><dd className="font-semibold">{inr(split.balance)}</dd></div>
                        </>
                      )}
                      {!advanceOn && priced && <p className="pt-1 text-xs text-[#0a2540]/60">Pay after service is completed.</p>}
                    </dl>
                  </section>
                  <button type="button" onClick={() => setStep(2)} className={btn}>Continue · {inr(subtotal)}</button>
                </>
              )}

              {/* ── STEP 2 ── */}
              {step === 2 && (
                <>
                  <section className="rounded-3xl bg-white p-4 shadow-sm">
                    <label className="block text-sm font-bold">Mobile number
                      <div className="mt-1 flex gap-2">
                        <span className="flex min-h-12 items-center rounded-2xl border-2 border-[#0a2540]/10 bg-[#eef4fb] px-3 font-bold">+91</span>
                        <input value={mobile} onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); if (otpSent) { setOtpSent(false); setOtp(""); } }} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10-digit mobile" disabled={!!token} className={input} />
                      </div>
                    </label>
                    {cfg?.otp && otpSent && (
                      <label className="mt-3 block text-sm font-bold">Enter the 6-digit OTP sent to +91 {mobile10}
                        <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="• • • • • •" className={`${input} mt-1 text-center text-xl tracking-[0.4em]`} />
                        {devCode && <span className="mt-1 block text-xs font-normal text-amber-700">Dev only — OTP: {devCode}</span>}
                      </label>
                    )}
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-[#0a2540]/60"><ShieldCheck className="size-4 text-emerald-600" />Your number is used only for this booking and service updates.</p>
                  </section>
                  {cfg == null ? <div className="h-14 animate-pulse rounded-2xl bg-white" /> : cfg.otp ? (
                    otpSent
                      ? <>
                          <button type="button" disabled={busy || otp.length !== 6} onClick={verifyOtp} className={btn}>{busy ? "Verifying…" : "Verify & Continue"}</button>
                          <button type="button" disabled={busy} onClick={sendOtp} className="w-full text-center text-sm font-bold text-primary">Resend OTP</button>
                        </>
                      : <button type="button" disabled={busy} onClick={sendOtp} className={btn}>{busy ? "Sending…" : "Send OTP"}</button>
                  ) : (
                    <button type="button" onClick={continueFromMobile} className={btn}>Continue</button>
                  )}
                </>
              )}

              {/* ── STEP 3 ── */}
              {step === 3 && (
                <>
                  <label className="block text-sm font-bold">Your name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={`${input} mt-1`} /></label>
                  <fieldset className="min-w-0 space-y-2 rounded-3xl bg-white p-3 shadow-sm">
                    <legend className="sr-only">Service address</legend>
                    <p className="flex items-center gap-1.5 text-sm font-bold"><MapPin className="size-4 text-primary" />{savedSites.length > 0 ? "Saved addresses" : "Full address"}</p>
                    {savedSites.length > 0 && (
                      <div role="radiogroup" aria-label="Saved addresses" className="space-y-2">
                        {savedSites.map((s) => (
                          <label key={s.id} className={`flex cursor-pointer gap-2.5 rounded-2xl border-2 p-3 text-sm ${siteId === s.id ? "border-primary bg-primary/5" : "border-[#0a2540]/10"}`}>
                            <input type="radio" name="site" checked={siteId === s.id} onChange={() => setSiteId(s.id)} className="mt-1 accent-[#0b5ed7]" />
                            <span><span className="font-extrabold">{s.label}</span><span className="block text-[#0a2540]/75">{s.address}{s.pinCode ? ` – ${s.pinCode}` : ""}</span></span>
                          </label>
                        ))}
                        <label className={`flex cursor-pointer gap-2.5 rounded-2xl border-2 p-3 text-sm ${siteId === "new" ? "border-primary bg-primary/5" : "border-dashed border-[#0a2540]/20"}`}>
                          <input type="radio" name="site" checked={siteId === "new"} onChange={() => setSiteId("new")} className="mt-1 accent-[#0b5ed7]" />
                          <span className="font-extrabold text-primary">+ Add another address</span>
                        </label>
                      </div>
                    )}
                    {usingNew && (
                      <>
                        <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} autoComplete="street-address" placeholder="Full Address (Flat, Building, Area, Landmark)" aria-label="Full address" className={`${input} py-3`} />
                        <button type="button" onClick={locate} disabled={gpsState === "locating"} className={`inline-flex min-h-10 items-center gap-1 text-xs font-bold ${gps ? "text-emerald-700" : "text-primary"}`}>
                          {gps ? `📍 Location added (±${gps.acc} m)` : gpsState === "locating" ? "Locating…" : "📍 Use current location"}
                        </button>
                        {gpsState === "denied" && <p className="text-xs text-amber-700">Location unavailable — the address above is enough.</p>}
                      </>
                    )}
                  </fieldset>
                  {gap > 0 && (
                    <div role="alert" className="rounded-3xl bg-amber-50 p-3 ring-1 ring-amber-200">
                      <p className="text-xs font-bold text-amber-900">{ZONE_B_MOV_MESSAGE}</p>
                      <p className="mt-0.5 text-xs text-amber-800">Add {inr(gap)} more to book.</p>
                      {(upgrade.length > 0 || upgradeFallback.length > 0) && (
                        <button type="button" onClick={() => setExtras((cur) => [...cur, ...[...upgrade, ...upgradeFallback].filter((u) => !cur.some((x) => x.contentId === u.contentId))])} className="mt-2 min-h-12 w-full rounded-2xl bg-amber-400 px-3 text-sm font-extrabold text-[#0a2540] shadow-sm hover:bg-amber-300">Add Add-on / Upgrade to {inr(MOQ_VALUE)} Combo</button>
                      )}
                    </div>
                  )}
                  <label className="block text-sm font-bold">Special notes <span className="font-normal text-[#0a2540]/50">(optional)</span><input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Size, special requests, best time to call" className={`${input} mt-1`} /></label>
                  <button type="button" onClick={next} className={btn}>Continue</button>
                </>
              )}

              {/* ── STEP 4 ── */}
              {step === 4 && (
                <>
                  <fieldset className="min-w-0">
                    <legend className="flex items-center gap-1.5 text-sm font-bold"><CalendarCheck className="size-4 text-primary" />Date</legend>
                    {days === null ? <div className="mt-1.5 h-52 animate-pulse rounded-3xl bg-white" /> : days.length === 0
                      ? <input type="date" min={istToday()} value={date} onChange={(e) => { setDate(e.target.value); setSlot(""); }} className={`${input} mt-1.5`} aria-label="Preferred date" />
                      : <CompactCalendar days={days} value={date} onChange={(d) => { setDate(d); setSlot(""); }} />}
                  </fieldset>
                  <fieldset className="min-w-0">
                    <legend className="flex items-center gap-1.5 text-sm font-bold"><Clock className="size-4 text-primary" />Arrival time</legend>
                    {!visibleSlots ? (
                      <div className="mt-1.5 flex flex-wrap gap-2">{Array.from({ length: 3 }, (_, i) => <span key={i} className="h-11 w-36 animate-pulse rounded-full bg-white" />)}</div>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Arrival time">
                        {visibleSlots.map((s) => (
                          <button key={s.slot} type="button" role="radio" aria-checked={s.slot === slot} disabled={!s.available} onClick={() => setSlot(s.slot)} className={`min-h-11 rounded-full border-2 px-4 text-sm font-extrabold transition ${s.slot === slot ? "border-primary bg-primary text-white" : "border-[#0a2540]/10 bg-white"} ${s.available ? "hover:border-primary/50" : "cursor-not-allowed line-through opacity-50"}`}>
                            {slotDisplay(s.slot)}
                          </button>
                        ))}
                      </div>
                    )}
                    {category === "HOME_DEEP_CLEANING" && <p className="mt-2 text-xs text-[#0a2540]/60">Full house cleaning takes 6–8 hours, so the team arrives between 8 AM and 2 PM.</p>}
                  </fieldset>
                  <button type="button" onClick={next} className={btn}>Continue</button>
                </>
              )}

              {/* ── STEP 5 ── */}
              {step === 5 && (
                <>
                  <section className="rounded-3xl bg-white p-4 text-sm shadow-sm">
                    <dl className="space-y-1.5">
                      <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">Service</dt><dd className="text-right font-semibold">{label}{extras.length ? ` + ${extras.map((x) => x.name.replace(" (add-on)", "")).join(" + ")}` : ""}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">Slot</dt><dd className="text-right font-semibold">{slotText}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/60">Address</dt><dd className="text-right font-semibold">{(usingNew ? address : site!.address).slice(0, 90)}</dd></div>
                      <div className="flex justify-between gap-3 border-t border-[#0a2540]/10 pt-2"><dt className="font-extrabold">Total</dt><dd className="font-extrabold">{inr(subtotal)}</dd></div>
                      {advanceOn ? (
                        <>
                          <div className="flex justify-between gap-3 text-emerald-700"><dt className="font-bold">Pay now ({split.percent}% advance)</dt><dd className="font-extrabold">{inr(split.advance)}</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-[#0a2540]/70">Remaining {100 - split.percent}%</dt><dd className="font-semibold">{inr(split.balance)} <span className="text-xs font-normal text-[#0a2540]/60">· Payable after service completion</span></dd></div>
                        </>
                      ) : <p className="pt-1 text-xs text-[#0a2540]/60">Pay after service is completed.</p>}
                    </dl>
                  </section>
                  <p className="rounded-2xl bg-amber-50 px-3 py-2 text-center text-sm font-bold text-amber-900">⭐ Rated {TRUST.rating}★ by {TRUST.siteReviewLabel} Happy Customers in Pune</p>
                  <p className="text-center text-xs text-[#0a2540]/70">100% Free Cancellation &amp; Rescheduling up to 24 hours before service (10% fee within 24 hrs; 20% after team dispatch).</p>
                  <input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                  {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
                  <button type="button" disabled={busy} onClick={bookAndPay} className={btn}>{busy ? "Please wait…" : advanceOn ? `Pay ${inr(split.advance)} & Confirm Booking` : "Confirm Your Booking"}</button>
                  <p className="flex items-center justify-center gap-1 text-center text-xs text-[#0a2540]/60"><Phone className="size-3" />
                    {callback === "sent" ? "Done — our team will call you shortly." : <button type="button" disabled={callback === "sending"} onClick={requestCallback} className="underline underline-offset-2">Need help or custom quote? Request a callback</button>}
                  </p>
                </>
              )}
              {step !== 5 && error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Compact 30-day month grid: small cells so the date and the time pills fit without scrolling on phones and desktop. */
function CompactCalendar({ days, value, onChange }: { days: DayInfo[]; value: string; onChange: (ymd: string) => void }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const months = Array.from(new Set(days.map((d) => d.date.slice(0, 7))));
  const [m, setM] = useState(Math.max(0, months.indexOf((value || days[0]!.date).slice(0, 7))));
  const ym = months[m] ?? months[0]!;
  const [y, mo] = ym.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  const title = first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="mt-1.5 rounded-3xl bg-white p-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setM((v) => Math.max(0, v - 1))} disabled={m === 0} aria-label="Previous month" className="flex size-8 items-center justify-center rounded-full bg-[#eef4fb] font-bold disabled:opacity-30">‹</button>
        <p className="text-sm font-extrabold">{title}</p>
        <button type="button" onClick={() => setM((v) => Math.min(months.length - 1, v + 1))} disabled={m >= months.length - 1} aria-label="Next month" className="flex size-8 items-center justify-center rounded-full bg-[#eef4fb] font-bold disabled:opacity-30">›</button>
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold uppercase text-[#0a2540]/45">{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d}>{d}</span>)}</div>
      <div className="mt-0.5 grid grid-cols-7 gap-0.5" role="radiogroup" aria-label={`Dates in ${title}`}>
        {cells.map((c, i) => {
          if (!c) return <span key={`b${i}`} />;
          const d = byDate.get(c);
          const on = c === value;
          const day = Number(c.slice(8));
          if (!d) return <span key={c} className="flex h-9 items-center justify-center text-xs text-[#0a2540]/25">{day}</span>;
          return (
            <button key={c} type="button" role="radio" aria-checked={on} aria-label={`${c} — ${STATUS_TEXT[d.status]}`} disabled={!d.available} onClick={() => onChange(c)} className={`flex h-9 flex-col items-center justify-center rounded-lg text-xs font-extrabold ring-1 transition ${on ? "bg-primary text-white shadow ring-primary" : TONE[d.status]} ${d.available ? "" : "cursor-not-allowed line-through"}`}>
              {day}
              <span className={`size-1 rounded-full ${on ? "bg-white" : DOT[d.status]}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
