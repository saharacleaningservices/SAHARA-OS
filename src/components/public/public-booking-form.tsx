"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  User,
  Phone,
  MapPin,
  Sparkles,
  CalendarDays,
  CreditCard,
  Lock,
  Sofa,
  BedDouble,
  Refrigerator,
  Bug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapsLocationInput, type MapsLocationValue } from "@/components/shared/maps-location-input";
import { PaymentDetailsBox, type CompanyPaymentDetails } from "@/components/shared/payment-details-box";
import {
  TIME_SLOTS,
  ADDON_SERVICE_PRICES,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  propertyTypesFor,
  SERVICE_CATALOG,
  SERVICE_RULES,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { publicBookLead } from "@/server/actions/public-booking";

// The four customer-facing categories shown on the public booking page.
const CATEGORIES: { value: string; label: string }[] = [
  { value: "HOME_DEEP_CLEANING", label: "Home Cleaning" },
  { value: "COMMERCIAL_CLEANING", label: "Commercial Cleaning" },
  { value: "PAINTING", label: "Interior Painting" },
  { value: "PEST_CONTROL", label: "Pest Control" },
];

const ADDON_ICONS: Record<string, typeof Sofa> = {
  "Sofa Shampooing": Sofa,
  "Mattress Cleaning": BedDouble,
  "Refrigerator Cleaning": Refrigerator,
  "Pest Control": Bug,
};

export function PublicBookingForm({
  referralCode,
  mapsApiKey = null,
  leadSource = "",
  paymentDetails,
  prefillName = "",
  prefillMobile = "",
}: {
  referralCode?: string;
  mapsApiKey?: string | null;
  leadSource?: string;
  paymentDetails: CompanyPaymentDetails;
  prefillName?: string;
  prefillMobile?: string;
}) {
  const [name, setName] = useState(prefillName);
  const [mobile, setMobile] = useState(prefillMobile);
  const [address, setAddress] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [category, setCategory] = useState("");
  const [variant, setVariant] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [addOns, setAddOns] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loc, setLoc] = useState<MapsLocationValue>({ mapLink: "", lat: null, lng: null });
  const [payChoice, setPayChoice] = useState<"ADVANCE" | "LATER">("ADVANCE");
  const [estimated, setEstimated] = useState("");
  const [advance, setAdvance] = useState("");
  const [payMode, setPayMode] = useState("UPI");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ leadNumber: string; advancePaid: boolean } | null>(null);

  const estNum = Number(estimated) || 0;
  const advNum = Math.min(Number(advance) || 0, estNum || Infinity);
  const balance = Math.max(estNum - advNum, 0);
  const serviceOptions = category ? SERVICE_CATALOG[category] ?? [] : [];
  const serviceRule = variant ? SERVICE_RULES[variant] : "";

  function toggleAddOn(n: string) {
    setAddOns((prev) => (prev.includes(n) ? prev.filter((a) => a !== n) : [...prev, n]));
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!category || !variant) {
      setError("Please choose a service category and a service.");
      return;
    }
    const advancePaid = payChoice === "ADVANCE" && advNum > 0;
    setSubmitting(true);
    const res = await publicBookLead({
      name,
      mobile,
      alternateMobile: "",
      email: "",
      address,
      pinCode: "",
      serviceCategory: category,
      serviceVariant: variant,
      propertyType,
      packageName: "",
      comboServices: [],
      addOnServices: addOns,
      serviceDate,
      timeSlot,
      notes,
      mapLink: loc.mapLink,
      website: "",
      source: leadSource,
      referralCode: referralCode || "",
      estimatedAmount: estNum || undefined,
      advanceAmount: advancePaid ? advNum : undefined,
      paymentMode: payMode,
      advancePaid,
    });
    setSubmitting(false);
    if ("error" in res) {
      setError(res.error ?? "Something went wrong");
      return;
    }
    setDone({ leadNumber: res.leadNumber, advancePaid });
  }

  if (done) {
    const row = (label: string, value: string) => (
      <div className="flex justify-between gap-3 py-0.5">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="text-right font-medium text-foreground">{value}</dd>
      </div>
    );
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <CheckCircle2 className="size-12 text-success" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Booking request received!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Our team will confirm within 5–15 minutes with a WhatsApp message on {mobile || "your number"}.
          </p>
        </div>
        <dl className="w-full space-y-0.5 rounded-xl border border-border bg-muted/30 p-4 text-left text-sm">
          {row("Booking ID", done.leadNumber)}
          {row("Customer", name)}
          {row("Service", variant || "—")}
          {propertyType ? row("Property Type", propertyType) : null}
          {serviceDate ? row("Preferred date", serviceDate) : null}
          {timeSlot ? row("Preferred time", timeSlot) : null}
          {addOns.length ? row("Add-ons", addOns.join(", ")) : null}
          {estNum ? row("Estimated", formatINR(estNum)) : null}
          {estNum ? row("Advance", formatINR(done.advancePaid ? advNum : 0)) : null}
          {estNum ? row("Balance", formatINR(done.advancePaid ? balance : estNum)) : null}
          {row("Payment Status", done.advancePaid ? "Advance Paid" : "Pay Later")}
        </dl>
        <div className="flex w-full flex-col gap-2">
          <a
            href={`https://wa.me/918956567130?text=${encodeURIComponent(`Hi, I just booked online. My booking ID is ${done.leadNumber}.`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-sm font-semibold text-white"
          >
            <Phone className="size-4" /> Message us on WhatsApp
          </a>
          <a
            href="tel:+917083347130"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary px-4 py-3 text-sm font-semibold text-primary"
          >
            <Phone className="size-4" /> Call 7083347130
          </a>
        </div>
      </div>
    );
  }

  const fieldWrap = "space-y-1.5";
  const iconInput = "relative";
  const iconEl = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground";

  return (
    <form onSubmit={submitBooking} className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">Book Your Cleaning Service</h2>
          <p className="text-sm text-muted-foreground">Get a cleaner, healthier and happier space in just a few clicks.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={fieldWrap}>
          <Label htmlFor="pb-name">Full Name <span className="text-destructive">*</span></Label>
          <div className={iconInput}>
            <User className={`${iconEl} size-4`} />
            <Input id="pb-name" className="pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" required />
          </div>
        </div>
        <div className={fieldWrap}>
          <Label htmlFor="pb-mobile">Mobile Number <span className="text-destructive">*</span></Label>
          <div className={iconInput}>
            <Phone className={`${iconEl} size-4`} />
            <Input id="pb-mobile" className="pl-9" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Enter mobile number" required />
          </div>
        </div>
      </div>

      <div className={fieldWrap}>
        <Label htmlFor="pb-address">Address <span className="text-destructive">*</span></Label>
        <div className={iconInput}>
          <MapPin className={`${iconEl} size-4`} />
          <Textarea id="pb-address" className="pl-9" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Enter complete address" required />
        </div>
        <p className="text-xs text-muted-foreground">We will use this to provide accurate service.</p>
        <MapsLocationInput value={loc} onChange={setLoc} apiKey={mapsApiKey} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={fieldWrap}>
          <Label>Service Category <span className="text-destructive">*</span></Label>
          <Select value={category} onValueChange={(v) => { setCategory(v); setVariant(""); setPropertyType(""); }}>
            <SelectTrigger><SelectValue placeholder="Select Service Category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className={fieldWrap}>
          <Label>Property Type <span className="text-destructive">*</span></Label>
          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger><SelectValue placeholder="Select Property Type" /></SelectTrigger>
            <SelectContent>
              {propertyTypesFor(category).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={fieldWrap}>
          <Label htmlFor="pb-date">Preferred Date <span className="text-destructive">*</span></Label>
          <div className={iconInput}>
            <CalendarDays className={`${iconEl} size-4`} />
            <Input id="pb-date" type="date" className="pl-9" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} required />
          </div>
        </div>
        <div className={fieldWrap}>
          <Label>Preferred Time <span className="text-destructive">*</span></Label>
          <Select value={timeSlot} onValueChange={setTimeSlot}>
            <SelectTrigger><SelectValue placeholder="Select Time" /></SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={fieldWrap}>
        <Label>Select Service <span className="text-destructive">*</span></Label>
        <Select value={variant} onValueChange={setVariant} disabled={!category}>
          <SelectTrigger><SelectValue placeholder={category ? "Select Service" : "Pick a category first"} /></SelectTrigger>
          <SelectContent>
            {serviceOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        {serviceRule && <p className="text-xs font-medium text-primary">{serviceRule}</p>}
      </div>

      <div className="space-y-2">
        <Label>Combo Package (optional)</Label>
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
          Choose Combo Package — <span className="font-medium">Coming Soon</span>
        </div>
      </div>

      {/* Add-on services */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-primary text-white">
            <CheckCircle2 className="size-3.5" />
          </span>
          <p className="text-sm font-semibold text-foreground">Add-on Services <span className="font-normal text-muted-foreground">(Optional)</span></p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {ADDON_SERVICE_PRICES.map(({ name: svc, price }) => {
            const Icon = ADDON_ICONS[svc] ?? Sparkles;
            const on = addOns.includes(svc);
            return (
              <button
                type="button"
                key={svc}
                onClick={() => toggleAddOn(svc)}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                  on ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/40"
                }`}
              >
                <Icon className={`size-5 ${on ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium text-foreground">{svc}</span>
                <span className="text-[11px] text-muted-foreground">{price}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment option */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Payment Option <span className="text-destructive">*</span></p>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border">
          <label className="flex cursor-pointer items-start gap-3 p-3.5">
            <input type="radio" name="pay" className="mt-1 accent-primary" checked={payChoice === "ADVANCE"} onChange={() => setPayChoice("ADVANCE")} />
            <span>
              <span className="block text-sm font-semibold text-foreground">Pay Advance <span className="font-normal text-muted-foreground">(Secure &amp; Confirm Booking)</span></span>
              <span className="block text-xs text-muted-foreground">Pay a small advance to confirm your booking.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 p-3.5">
            <input type="radio" name="pay" className="mt-1 accent-primary" checked={payChoice === "LATER"} onChange={() => setPayChoice("LATER")} />
            <span>
              <span className="block text-sm font-semibold text-foreground">Pay Later</span>
              <span className="block text-xs text-muted-foreground">Book now and pay after the service is completed.</span>
            </span>
          </label>
        </div>

        {payChoice === "ADVANCE" && (
          <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-3.5">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Estimated ₹</Label>
                <Input inputMode="numeric" value={estimated} onChange={(e) => setEstimated(e.target.value.replace(/\D/g, ""))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Advance ₹</Label>
                <Input inputMode="numeric" value={advance} onChange={(e) => setAdvance(e.target.value.replace(/\D/g, ""))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Balance</Label>
                <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium">{formatINR(balance)}</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_MODES.map((m) => (
                <button type="button" key={m} onClick={() => setPayMode(m)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium ${payMode === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                  {PAYMENT_MODE_LABELS[m]}
                </button>
              ))}
            </div>
            <PaymentDetailsBox mode={payMode} details={paymentDetails} />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pb-notes">Notes (optional)</Label>
        <Textarea id="pb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Parking, lift, pets, urgent requirement…" />
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <Button type="submit" size="lg" disabled={submitting}
        className="h-12 w-full rounded-xl bg-success text-base font-semibold text-white hover:bg-success/90">
        {submitting ? <Loader2 className="animate-spin" /> : <Phone className="size-4" />}
        Confirm &amp; Book Now
        <span aria-hidden>›</span>
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Lock className="size-3.5" /> Your information is 100% secure with us.
      </p>
    </form>
  );
}
