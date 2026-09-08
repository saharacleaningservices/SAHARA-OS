"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ServiceCategoryPicker } from "@/components/shared/service-category-picker";
import { MapsLocationInput, type MapsLocationValue } from "@/components/shared/maps-location-input";
import { UpsellOfferCard, type UpsellOffer } from "@/components/shared/upsell-offer-card";
import { PaymentDetailsBox, type CompanyPaymentDetails } from "@/components/shared/payment-details-box";
import { TIME_SLOTS, ADDON_SERVICES, COMBO_SERVICES, PAYMENT_MODES, PAYMENT_MODE_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { publicBookLead } from "@/server/actions/public-booking";

export function PublicBookingForm({
  referralCode,
  mapsApiKey = null,
  leadSource = "",
  paymentDetails,
}: {
  referralCode?: string;
  mapsApiKey?: string | null;
  leadSource?: string;
  paymentDetails: CompanyPaymentDetails;
}) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [alternateMobile, setAlternateMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [category, setCategory] = useState("HOME_DEEP_CLEANING");
  const [variant, setVariant] = useState("");
  const [packageName, setPackageName] = useState("");
  const [addOns, setAddOns] = useState<string[]>([]);
  const [combos, setCombos] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loc, setLoc] = useState<MapsLocationValue>({ mapLink: "", lat: null, lng: null });
  const [upsell, setUpsell] = useState<{ offer: UpsellOffer | null; accepted: boolean }>({ offer: null, accepted: false });
  const [estimated, setEstimated] = useState("");
  const [advance, setAdvance] = useState("");
  const [payMode, setPayMode] = useState("UPI");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ leadNumber: string; advancePaid: boolean } | null>(null);

  const estNum = Number(estimated) || 0;
  const advNum = Math.min(Number(advance) || 0, estNum || Infinity);
  const balance = Math.max(estNum - advNum, 0);

  function toggleAddOn(name: string) {
    setAddOns((prev) => (prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]));
  }
  function toggleCombo(name: string) {
    setCombos((prev) => (prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]));
  }

  async function submitBooking(advancePaid: boolean) {
    setError("");
    setSubmitting(true);
    const res = await publicBookLead({
      name,
      mobile,
      alternateMobile,
      email,
      address,
      pinCode,
      serviceCategory: category,
      serviceVariant: variant,
      packageName,
      comboServices: combos,
      addOnServices: addOns,
      serviceDate,
      timeSlot,
      notes,
      mapLink: loc.mapLink,
      website: "",
      source: leadSource,
      referralCode: referralCode || "",
      estimatedAmount: estNum || undefined,
      advanceAmount: advancePaid ? advNum || undefined : undefined,
      paymentMode: payMode,
      advancePaid,
      upsellRuleId: upsell.offer?.id || "",
      upsellLabel: upsell.offer?.label || "",
      upsellValue: upsell.offer?.comboPrice ?? 0,
      upsellAccepted: upsell.accepted,
    });
    setSubmitting(false);
    if ("error" in res) {
      setError(res.error ?? "Something went wrong");
      return;
    }
    setDone({ leadNumber: res.leadNumber, advancePaid });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitBooking(false);
  }

  if (done) {
    const row = (label: string, value: string) => (
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="text-right font-medium text-foreground">{value}</dd>
      </div>
    );
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center sahara-shadow sm:p-8">
        <CheckCircle2 className="size-12 text-success" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Thanks — request received!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Our team will confirm within 5–15 minutes and you&apos;ll get a WhatsApp confirmation on{" "}
            {mobile || "your number"}.
          </p>
        </div>
        <dl className="w-full space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-left text-sm">
          {row("Booking ID", done.leadNumber)}
          {row("Customer", name)}
          {row("Service", `${variant || "—"}`)}
          {packageName ? row("Package", packageName) : null}
          {combos.length ? row("Combo Services", combos.join(", ")) : null}
          {serviceDate ? row("Requested date", serviceDate) : null}
          {timeSlot ? row("Time slot", timeSlot) : null}
          {estNum ? row("Estimated", formatINR(estNum)) : null}
          {estNum ? row("Advance", formatINR(done.advancePaid ? advNum : 0)) : null}
          {estNum ? row("Balance", formatINR(done.advancePaid ? balance : estNum)) : null}
          {row("Payment Status", done.advancePaid ? "Advance Paid" : "Pending Advance")}
        </dl>
        <div className="flex w-full flex-col gap-2">
          <a
            href={`https://wa.me/918956567130?text=${encodeURIComponent(`Hi, I just booked online. My booking ID is ${done.leadNumber}.`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-white"
          >
            Message us on WhatsApp
          </a>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground"
            title="Booking tracking is coming soon"
          >
            Track Booking (coming soon)
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5 sahara-shadow sm:p-6">
      <div className="space-y-1.5">
        <Label htmlFor="pb-name">Your Name</Label>
        <Input id="pb-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pb-mobile">Mobile Number</Label>
          <Input id="pb-mobile" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="9876543210" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pb-alt-mobile">Alternate Mobile (optional)</Label>
          <Input id="pb-alt-mobile" inputMode="tel" value={alternateMobile} onChange={(e) => setAlternateMobile(e.target.value)} placeholder="Second number" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pb-email">Email (optional)</Label>
        <Input id="pb-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_130px]">
        <div className="space-y-1.5">
          <Label htmlFor="pb-address">Full Address</Label>
          <Textarea id="pb-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Flat / house no, building, street, landmark" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pb-pin">PIN Code</Label>
          <Input id="pb-pin" inputMode="numeric" maxLength={6} value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))} placeholder="411028" required />
        </div>
      </div>

      <MapsLocationInput value={loc} onChange={setLoc} apiKey={mapsApiKey} />

      <ServiceCategoryPicker
        category={category}
        variant={variant}
        packageName={packageName}
        onCategoryChange={(v) => { setCategory(v); setVariant(""); setPackageName(""); }}
        onVariantChange={setVariant}
        onPackageChange={setPackageName}
      />

      <div className="space-y-2">
        <Label>Combo Services (optional)</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {COMBO_SERVICES.map((c) => (
            <label
              key={c}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${
                combos.includes(c) ? "border-primary bg-accent" : "border-border"
              }`}
            >
              <Checkbox checked={combos.includes(c)} onCheckedChange={() => toggleCombo(c)} />
              <span>{c}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Add-on Services (optional)</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ADDON_SERVICES.map((svc) => (
            <label
              key={svc}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${
                addOns.includes(svc) ? "border-primary bg-accent" : "border-border"
              }`}
            >
              <Checkbox checked={addOns.includes(svc)} onCheckedChange={() => toggleAddOn(svc)} />
              <span>{svc}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Price will be shared after quotation.</p>
      </div>

      <UpsellOfferCard category={category} onChange={(offer, accepted) => setUpsell({ offer, accepted })} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pb-service-date">Requested Service Date</Label>
          <Input id="pb-service-date" type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Time Slot</Label>
          <Select value={timeSlot} onValueChange={setTimeSlot}>
            <SelectTrigger>
              <SelectValue placeholder="Select a slot" />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((slot) => (
                <SelectItem key={slot} value={slot}>
                  {slot}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pb-notes">Notes / Custom Requirement (optional)</Label>
        <Textarea id="pb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Parking, lift, pets, urgent requirement…" />
      </div>

      {/* ── Advance payment (optional) ────────────────────────────── */}
      <div className="space-y-3 rounded-xl border border-primary/20 bg-accent/30 p-4">
        <p className="text-sm font-semibold text-foreground">Advance Payment (optional)</p>
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
            <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium">
              {formatINR(balance)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {PAYMENT_MODES.map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setPayMode(m)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium ${
                payMode === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
              }`}
            >
              {PAYMENT_MODE_LABELS[m]}
            </button>
          ))}
        </div>

        <PaymentDetailsBox mode={payMode} details={paymentDetails} />

        <p className="text-xs text-muted-foreground">Price will be confirmed by our team after a quick quotation.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        <Button
          type="button"
          className="w-full"
          size="lg"
          disabled={submitting}
          onClick={() => submitBooking(true)}
        >
          {submitting && <Loader2 className="animate-spin" />}
          {advNum > 0 ? `I've Paid ${formatINR(advNum)} Advance` : "I've Paid the Advance"}
        </Button>
        <Button type="submit" className="w-full" size="lg" variant="outline" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          Book Now, Pay Later
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">Confirmation within 5–15 minutes.</p>
    </form>
  );
}
