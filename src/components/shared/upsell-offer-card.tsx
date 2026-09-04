"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchUpsellOffer } from "@/server/actions/upsell";
import { formatINR } from "@/lib/utils";

export type UpsellOffer = {
  id: string;
  label: string;
  comboCategory: string;
  comboVariant: string | null;
  comboPrice: number | null;
};

/** Shows a combo/upsell suggestion for the currently-selected service category
 * (Smart Upsell Engine). Reports the offer + accepted state up so the parent
 * form can send it along on submit for conversion tracking. */
export function UpsellOfferCard({
  category,
  onChange,
}: {
  category: string;
  onChange: (offer: UpsellOffer | null, accepted: boolean) => void;
}) {
  const [offer, setOffer] = useState<UpsellOffer | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    setAccepted(false);
    fetchUpsellOffer(category).then((res) => {
      if (active) setOffer(res);
    });
    return () => {
      active = false;
    };
  }, [category]);

  useEffect(() => {
    onChange(offer, accepted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer, accepted]);

  if (!offer) return null;

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(Boolean(v))} className="mt-0.5" />
      <div className="flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Sparkles className="size-3.5 text-primary" /> {offer.label}
        </p>
        <p className="text-xs text-muted-foreground">
          {offer.comboVariant ? `${offer.comboVariant} — ` : ""}
          {offer.comboPrice ? `Just ${formatINR(offer.comboPrice)} more` : "Special combo price"}
        </p>
      </div>
    </label>
  );
}
