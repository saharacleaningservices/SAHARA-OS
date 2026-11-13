"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ServiceCategoryPicker } from "@/components/shared/service-category-picker";
import { ShareLocationButton } from "@/components/shared/share-location-button";
import { UpsellOfferCard, type UpsellOffer } from "@/components/shared/upsell-offer-card";
import { publicBookLead } from "@/server/actions/public-booking";
import { resolveZone, customerTypeFor, minimumOrderValue } from "@/lib/zones";

const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "gclid", "fbclid"] as const;
const ATTRIBUTION_STORAGE = "sahara_attribution";

export function PublicBookingForm({ referralCode }: { referralCode?: string }) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("HOME_DEEP_CLEANING");
  const [variant, setVariant] = useState("");
  const [notes, setNotes] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [upsell, setUpsell] = useState<{ offer: UpsellOffer | null; accepted: boolean }>({ offer: null, accepted: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [pincode, setPincode] = useState("");
  const [attribution, setAttribution] = useState<Record<string, string>>({});

  // Capture ad attribution from the landing URL; keep it for the session so it
  // survives in-site navigation before the visitor submits.
  useEffect(() => {
    const found: Record<string, string> = {};
    try {
      const params = new URLSearchParams(window.location.search);
      for (const k of ATTRIBUTION_KEYS) {
        const v = params.get(k);
        if (v) found[k] = v.slice(0, 300);
      }
      if (Object.keys(found).length) sessionStorage.setItem(ATTRIBUTION_STORAGE, JSON.stringify(found));
      const stored = JSON.parse(sessionStorage.getItem(ATTRIBUTION_STORAGE) ?? "{}");
      setAttribution({ ...stored, ...found });
    } catch {
      setAttribution(found);
    }
  }, []);

  const zoneHint = useMemo(() => {
    const match = resolveZone({ area, address, pincode });
    if (!match) return null;
    const mov = minimumOrderValue(match.zone.id, customerTypeFor(category));
    return { name: match.zone.name, mov, footnote: match.zone.footnote };
  }, [area, address, pincode, category]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await publicBookLead({
      name,
      mobile,
      area,
      address,
      serviceCategory: category,
      serviceVariant: variant,
      notes,
      mapLink,
      website: "",
      referralCode: referralCode || "",
      upsellRuleId: upsell.offer?.id || "",
      upsellLabel: upsell.offer?.label || "",
      upsellValue: upsell.offer?.comboPrice ?? 0,
      upsellAccepted: upsell.accepted,
      pincode,
      utmSource: attribution.utm_source || "",
      utmMedium: attribution.utm_medium || "",
      utmCampaign: attribution.utm_campaign || "",
      gclid: attribution.gclid || "",
      fbclid: attribution.fbclid || "",
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
        <Label htmlFor="pb-area">Area</Label>
        <Input id="pb-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Magarpatta City" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pb-pincode">Pincode (optional)</Label>
        <Input id="pb-pincode" inputMode="numeric" maxLength={6} value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))} placeholder="411028" />
        {zoneHint && (
          <p className="text-xs text-muted-foreground">
            Service zone: <span className="font-medium text-foreground">{zoneHint.name}</span>
            {zoneHint.mov > 0 && zoneHint.footnote ? ` — ${zoneHint.footnote}` : ""}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pb-address">Full Address (optional)</Label>
        <Textarea id="pb-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
      </div>

      <ServiceCategoryPicker category={category} variant={variant} onCategoryChange={(v) => { setCategory(v); setVariant(""); }} onVariantChange={setVariant} />

      <UpsellOfferCard category={category} onChange={(offer, accepted) => setUpsell({ offer, accepted })} />

      <div className="space-y-1.5">
        <Label htmlFor="pb-notes">Anything else we should know? (optional)</Label>
        <Textarea id="pb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ShareLocationButton onShare={async (link) => { setMapLink(link); return { success: true }; }} />
        {mapLink && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <MapPin className="size-3" /> Location added
          </span>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="animate-spin" />}
        Request a Booking
      </Button>
    </form>
  );
}
