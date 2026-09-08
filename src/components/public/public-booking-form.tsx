"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ServiceCategoryPicker } from "@/components/shared/service-category-picker";
import { MapsLocationInput, type MapsLocationValue } from "@/components/shared/maps-location-input";
import { UpsellOfferCard, type UpsellOffer } from "@/components/shared/upsell-offer-card";
import { publicBookLead } from "@/server/actions/public-booking";

export function PublicBookingForm({
  referralCode,
  mapsApiKey = null,
}: {
  referralCode?: string;
  mapsApiKey?: string | null;
}) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [category, setCategory] = useState("HOME_DEEP_CLEANING");
  const [variant, setVariant] = useState("");
  const [notes, setNotes] = useState("");
  const [loc, setLoc] = useState<MapsLocationValue>({ mapLink: "", lat: null, lng: null });
  const [upsell, setUpsell] = useState<{ offer: UpsellOffer | null; accepted: boolean }>({ offer: null, accepted: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await publicBookLead({
      name,
      mobile,
      email,
      area,
      address,
      serviceCategory: category,
      serviceVariant: variant,
      serviceDate,
      notes,
      mapLink: loc.mapLink,
      website: "",
      referralCode: referralCode || "",
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
    setDone(res.leadNumber);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center sahara-shadow">
        <CheckCircle2 className="size-10 text-success" />
        <h2 className="text-lg font-semibold text-foreground">Thanks — request received!</h2>
        <p className="text-sm text-muted-foreground">
          Reference <span className="font-medium text-foreground">{done}</span>. Our team will call you shortly to
          confirm the details.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5 sahara-shadow sm:p-6">
      <div className="space-y-1.5">
        <Label htmlFor="pb-name">Your Name</Label>
        <Input id="pb-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pb-mobile">Mobile Number</Label>
        <Input id="pb-mobile" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="9876543210" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pb-email">Email (optional)</Label>
        <Input id="pb-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pb-area">Area</Label>
        <Input id="pb-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Magarpatta City" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pb-address">Full Address (optional)</Label>
        <Textarea id="pb-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pb-service-date">Preferred Service Date (optional)</Label>
        <Input
          id="pb-service-date"
          type="date"
          value={serviceDate}
          onChange={(e) => setServiceDate(e.target.value)}
        />
      </div>

      <ServiceCategoryPicker category={category} variant={variant} onCategoryChange={(v) => { setCategory(v); setVariant(""); }} onVariantChange={setVariant} />

      <UpsellOfferCard category={category} onChange={(offer, accepted) => setUpsell({ offer, accepted })} />

      <div className="space-y-1.5">
        <Label htmlFor="pb-notes">Anything else we should know? (optional)</Label>
        <Textarea id="pb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <MapsLocationInput value={loc} onChange={setLoc} apiKey={mapsApiKey} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="animate-spin" />}
        Request a Booking
      </Button>
    </form>
  );
}
