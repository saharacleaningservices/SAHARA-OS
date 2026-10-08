"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Loader2, Plus, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PRICE_GROUP_LABEL, PRICING_MASTER, type PriceGroup } from "@/lib/pricing-master";
import { saveFestivalOffer, savePriceSetting } from "@/server/actions/pricing";

type Setting = { contentId: string; price: number | null; mrp: number | null; isActive: boolean; updatedByName: string | null; updatedAt: string };
type Festival = { id: string; name: string; start: string; end: string; isActive: boolean; prices: Record<string, number> };

const GROUPS = Object.keys(PRICE_GROUP_LABEL) as PriceGroup[];
// Festival prices make sense for fixed-price items only (not per-sq-ft / inspection based).
const FESTIVAL_GROUPS: PriceGroup[] = ["PREMIUM", "PLATINUM", "COMBO", "CUSTOMISED"];
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function PricingManager({ settings, festivals }: { settings: Setting[]; festivals: Festival[] }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Festival offers</CardTitle>
          <p className="text-sm text-muted-foreground">
            Festival prices apply only to bookings whose service date falls inside the festival dates. Regular prices stay unchanged and apply on all other dates.
            Existing bookings keep the amount they were confirmed at.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {festivals.map((f) => (
            <FestivalEditor key={f.id} festival={f} />
          ))}
          <FestivalEditor festival={null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regular prices</CardTitle>
          <p className="text-sm text-muted-foreground">
            Feeds the landing pages, booking form, CRM price list and quotations. MRP is the genuine earlier price shown struck through — leave empty if none.
            Empty price = &quot;price after inspection / confirmed before booking&quot;.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* One collapsible per price group — open only what you are editing (unsaved edits stay while closed). */}
          {GROUPS.map((g) => (
            <details key={g} className="group rounded-lg border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold">
                <span>
                  {PRICE_GROUP_LABEL[g]}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">{PRICING_MASTER.filter((p) => p.group === g).length} items</span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="divide-y border-t">
                {PRICING_MASTER.filter((p) => p.group === g).map((p) => (
                  <PriceRow key={p.contentId} contentId={p.contentId} setting={settings.find((s) => s.contentId === p.contentId) ?? null} />
                ))}
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PriceRow({ contentId, setting }: { contentId: string; setting: Setting | null }) {
  const item = PRICING_MASTER.find((p) => p.contentId === contentId)!;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [price, setPrice] = useState(String(setting?.price ?? item.price ?? ""));
  const [mrp, setMrp] = useState(String(setting?.mrp ?? item.mrp ?? ""));
  const [active, setActive] = useState(setting?.isActive ?? true);
  const dirty =
    price !== String(setting?.price ?? item.price ?? "") || mrp !== String(setting?.mrp ?? item.mrp ?? "") || active !== (setting?.isActive ?? true);

  function save() {
    start(async () => {
      const res = await savePriceSetting({ contentId, price: num(price), mrp: num(mrp), isActive: active });
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(`${item.name} saved`);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-2 items-center gap-2 p-2 text-sm sm:grid-cols-[1fr_7rem_7rem_6rem_5rem]">
      <div className="col-span-2 sm:col-span-1">
        <p className="font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.contentId}
          {item.unit ? ` · ${item.unit}` : ""}
          {item.rule ? ` · ${item.rule}` : ""}
          {setting?.updatedByName ? ` · edited by ${setting.updatedByName}` : ""}
        </p>
      </div>
      <label className="text-xs">
        <span className="text-muted-foreground">Price ₹</span>
        <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="—" className="h-8" />
      </label>
      <label className="text-xs">
        <span className="text-muted-foreground">MRP ₹</span>
        <Input inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} placeholder="—" className="h-8" />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} /> Visible
      </label>
      <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || pending} onClick={save}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
      </Button>
    </div>
  );
}

function FestivalEditor({ festival }: { festival: Festival | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(festival != null);
  const [name, setName] = useState(festival?.name ?? "");
  const [from, setFrom] = useState(festival?.start ?? "");
  const [to, setTo] = useState(festival?.end ?? "");
  const [active, setActive] = useState(festival?.isActive ?? true);
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(festival?.prices ?? {}).map(([k, v]) => [k, String(v)])),
  );

  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add festival offer
      </Button>
    );

  function save() {
    start(async () => {
      const res = await saveFestivalOffer({
        id: festival?.id,
        name,
        start: from,
        end: to,
        isActive: active,
        prices: Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, num(v)])),
      });
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(`${name} offer saved`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_10rem_6rem]">
        <div>
          <Label className="text-xs">Festival name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali" className="h-8" />
        </div>
        <div>
          <Label className="text-xs">Start date</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" />
        </div>
        <div>
          <Label className="text-xs">End date</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" />
        </div>
        <label className="flex items-end gap-2 pb-1.5 text-xs">
          <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} /> Active
        </label>
      </div>
      <details open={festival == null}>
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Festival prices ({Object.values(prices).filter((v) => v.trim() !== "").length} set — empty = regular price)
        </summary>
        <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {PRICING_MASTER.filter((p) => FESTIVAL_GROUPS.includes(p.group) && p.price != null).map((p) => (
            <label key={p.contentId} className="flex items-center justify-between gap-2 text-xs">
              <span>
                {p.name} {p.unit ? <span className="text-muted-foreground">({p.unit})</span> : null}
              </span>
              <Input
                inputMode="decimal"
                value={prices[p.contentId] ?? ""}
                onChange={(e) => setPrices((s) => ({ ...s, [p.contentId]: e.target.value }))}
                placeholder="regular"
                className="h-7 w-24"
              />
            </label>
          ))}
        </div>
      </details>
      <Button size="sm" disabled={pending} onClick={save}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} {festival ? "Save offer" : "Create offer"}
      </Button>
    </div>
  );
}
