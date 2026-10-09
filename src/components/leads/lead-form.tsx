"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2, MapPin, Plus } from "lucide-react";
import { ContactTypeBadge, RepeatBadge } from "@/components/customers/contact-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { leadSchema, type LeadFormValues } from "@/lib/validation";
import { LEAD_SOURCE_OPTIONS, SERVICE_CATEGORY_TO_LEGACY, TIME_SLOTS, PAYMENT_MODES, PAYMENT_MODE_LABELS, LEAD_PAYMENT_STATUSES, LEAD_PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { formatINR, formatDate } from "@/lib/utils";
import { createLead, updateLead } from "@/server/actions/leads";
import { getRepeatCustomerSummary } from "@/server/actions/customer-actions";
import { ServiceCategoryPicker } from "@/components/shared/service-category-picker";
import { ServiceQuantityFields } from "@/components/shared/service-quantity-fields";
import { MapsLocationInput } from "@/components/shared/maps-location-input";
import { parseMapLink } from "@/lib/maps";
import { TeamSelect } from "@/components/shared/team-select";
import { ACQUISITION_CHANNELS } from "@/lib/attribution";
import { PackageCalculator } from "@/components/shared/package-calculator";
import { packageTotals, parsePackage, serializeLines, type PackageDraft } from "@/lib/package-calc";
import { getCatalogueForCrm } from "@/server/actions/pricing";
import { festivalForDate, needsInspection, unitPriceFor, type LivePricing } from "@/lib/pricing-master";
import { resolvePackageEstimate, type EstimateSource } from "@/lib/lead-estimate";

type StaffOption = { id: string; name: string; designation: string };
type UserOption = { id: string; name: string; role: string };

/** Optional part of the form, folded on phones to keep New Lead to 1–2 scrolls. */
function More({ title, hint, children, open = false }: { title: string; hint?: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-lg border sm:col-span-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold">
        <span>
          {title}
          {hint ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{hint}</span> : null}
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}

export function LeadForm({
  staffOptions,
  userOptions,
  defaultValues,
  leadId,
  mapsApiKey = null,
  canEditPricing = false,
  book = false,
}: {
  staffOptions: StaffOption[];
  userOptions: UserOption[];
  defaultValues?: Partial<LeadFormValues>;
  leadId?: string;
  mapsApiKey?: string | null;
  /** Super Admin / Accounts: may edit unit price, discount and final amount (server re-checks). */
  canEditPricing?: boolean;
  /** Dashboard "New Job": after saving, open the lead on Confirm Booking. */
  book?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Booking Form V2 parity — dynamic Service Type quantity/size sub-fields
  // (see ServiceQuantityFields) feed a live suggested estimate and a
  // selection summary that gets appended to Notes on submit, same as the
  // public booking form does. estimateTouched stops the auto-fill once the
  // user has typed their own Estimated Amount.
  const [estimateTouched, setEstimateTouched] = useState(false);
  const [selectionNotesLines, setSelectionNotesLines] = useState<string[]>([]);

    // Repeat-customer banner — populated when the mobile field's onBlur
    // finds history (previous jobs, last service date, lifetime revenue)
    // for that number, so office staff spot a returning customer instantly.
    const [repeatCustomer, setRepeatCustomer] = useState<Awaited<ReturnType<typeof getRepeatCustomerSummary>>>(null);
    const [checkingRepeat, setCheckingRepeat] = useState(false);
    async function handleMobileBlur(value: string) {
          if (leadId) return; // only relevant when creating a brand-new lead
          const digits = (value || "").replace(/\D/g, "").slice(-10);
          if (digits.length !== 10) {
                  setRepeatCustomer(null);
                  return;
          }
          setCheckingRepeat(true);
          const summary = await getRepeatCustomerSummary(digits).catch(() => null);
          setCheckingRepeat(false);
          setRepeatCustomer(summary);
          setSiteChoice(summary?.sites?.length ? "" : "NEW");
    }

  // Customer database (2026-10-08): reuse an existing contact and pick one of
  // its saved service sites, or add a new site — never re-type the profile.
  const [siteChoice, setSiteChoice] = useState<string>("NEW");
  function applyExistingCustomer() {
    if (!repeatCustomer) return;
    if (repeatCustomer.name) setValue("name", repeatCustomer.name, { shouldDirty: true });
    if (repeatCustomer.alternateMobile) setValue("alternateMobile", repeatCustomer.alternateMobile, { shouldDirty: true });
    if (repeatCustomer.email) setValue("email", repeatCustomer.email, { shouldDirty: true });
    setValue("contactType", repeatCustomer.contactType, { shouldDirty: true });
    setValue("isRepeat", true, { shouldDirty: true });
    toast.success("Customer details filled — choose a site below");
  }
  function chooseSite(id: string) {
    setSiteChoice(id);
    const site = repeatCustomer?.sites?.find((x) => x.id === id);
    setValue("siteId", site ? site.id : "", { shouldDirty: true });
    if (site) {
      setValue("address", site.address, { shouldDirty: true });
      setValue("pinCode", site.pinCode ?? "", { shouldDirty: true });
      if (site.area) setValue("area", site.area, { shouldDirty: true });
      setValue("mapLink", site.mapLink ?? "", { shouldDirty: true });
    }
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: "",
      mobile: "",
      alternateMobile: "",
      whatsapp: "",
      email: "",
      address: "",
      area: "",
      pinCode: "",
      service: "HOME_DEEP_CLEANING",
      source: "CALL",
      followUpDate: "",
      serviceDate: "",
      timeSlot: "",
      teamNumber: "",
      assignedStaffId: "",
      assignedStaffIds: [],
      assignedToId: "",
      notes: "",
      serviceCategory: "HOME_DEEP_CLEANING",
      serviceVariant: "",
      packageName: "",
      advanceAmount: undefined,
      paymentMode: "",
      paymentStatus: "PENDING",
      mapLink: "",
      propertyType: "",
      ...defaultValues,
    },
  });

  // Package Calculator (Customized Service): multiple services in one lead.
  const [pkg, setPkg] = useState<PackageDraft>(() => parsePackage(defaultValues?.serviceItems, defaultValues?.discountAmount));
  function applyPkg(d: PackageDraft) {
    setPkg(d);
    const tot = packageTotals(d);
    setValue("serviceItems", d.lines.length ? serializeLines(d) : "", { shouldDirty: true });
    setValue("discountAmount", tot.discount, { shouldDirty: true });
    if (d.lines.length) {
      setValue("quoteAmount", tot.final, { shouldDirty: true });
      setValue("serviceVariant", d.lines.length > 1 ? `${d.lines[0].name} + ${d.lines.length - 1} more` : d.lines[0].name);
    }
  }
  const isCustomized = (watch("serviceCategory") || "") === "CUSTOMIZER_PACKAGE";

  const estimated = Number(watch("quoteAmount")) || 0;
  const advReceived = Number(watch("advanceAmount")) || 0;
  const leadBalance = Math.max(estimated - advReceived, 0);

  const assignedStaffIds = watch("assignedStaffIds") ?? [];
  function toggleStaff(id: string) {
    const next = assignedStaffIds.includes(id)
      ? assignedStaffIds.filter((x) => x !== id)
      : [...assignedStaffIds, id];
    setValue("assignedStaffIds", next, { shouldDirty: true });
    setValue("assignedStaffId", next[0] ?? "", { shouldDirty: true });
  }

  const quoteAmountField = register("quoteAmount");

  // Full-home package (e.g. 2 BHK + Premium) → its approved amount from the live price list:
  // the Festival price when the requested date is inside an approved festival window, else Regular.
  // Runs only when the office changes the selection (a saved lead keeps its amount) and never
  // overrides an amount typed by hand.
  const [livePricing, setLivePricing] = useState<LivePricing | null>(null);
  useEffect(() => {
    getCatalogueForCrm().then((p) => p && setLivePricing(p)).catch(() => {});
  }, []);
  const homeVariant = watch("serviceVariant") || "";
  const homePackage = watch("packageName") || "";
  const homeDate = watch("serviceDate") || "";
  const homeCategory = watch("serviceCategory") || "HOME_DEEP_CLEANING";
  const [initialPkgKey] = useState(() => `${defaultValues?.serviceCategory ?? ""}|${defaultValues?.serviceVariant ?? ""}|${defaultValues?.packageName ?? ""}`);
  const [pkgPriceNote, setPkgPriceNote] = useState("");
  // Current package price for the selection (null when none) — drives the "custom quote active" banner.
  const [pkgPrice, setPkgPrice] = useState<number | null>(null);
  // Remembers the amount THIS form auto-filled from a package price, so a later change to a selection
  // without a package price (4 BHK+, villa, bungalow, …) can drop exactly that stale amount — and never
  // a figure staff typed or a saved lead's existing quote.
  const autoEstimateRef = useRef<number | null>(null);
  function syncPackageEstimate(price: number | null, propertyType: string) {
    const prevAmount = Number(getValues("quoteAmount")) || null;
    const source: EstimateSource = estimateTouched
      ? "MANUAL"
      : prevAmount != null && prevAmount === autoEstimateRef.current
        ? "AUTO"
        : prevAmount != null
          ? "MANUAL"
          : "NONE";
    const r = resolvePackageEstimate({ amount: prevAmount, source }, { propertyType, price });
    if (r.source === "AUTO") {
      autoEstimateRef.current = r.amount;
      setValue("quoteAmount", r.amount ?? undefined, { shouldDirty: true });
    } else if (source === "AUTO") {
      autoEstimateRef.current = null; // stale auto estimate dropped
      setValue("quoteAmount", undefined, { shouldDirty: true });
    }
    return r;
  }
  useEffect(() => {
    if (!livePricing || homeCategory !== "HOME_DEEP_CLEANING" || !homeVariant || !homePackage) {
      setPkgPriceNote("");
      setPkgPrice(null);
      // Package/category cleared: never leave an auto-filled package estimate behind.
      if (livePricing && autoEstimateRef.current != null) syncPackageEstimate(null, homeVariant);
      return;
    }
    if (leadId && `${homeCategory}|${homeVariant}|${homePackage}` === initialPkgKey) return;
    const want = homeVariant.replace(/\s+/g, "").toLowerCase();
    const item = livePricing.items.find((i) => i.group === homePackage.toUpperCase() && i.name.replace(/\s+/g, "").toLowerCase().startsWith(want));
    const festival = homeDate ? festivalForDate(livePricing.festivals, homeDate) : null;
    const price = item ? unitPriceFor(item, festival) : null;
    const r = syncPackageEstimate(price, homeVariant);
    setPkgPrice(r.mode === "PRICED" ? price : null);
    if (r.mode !== "PRICED" || !item || price == null) {
      // No package price: not a priced package, so no festival/regular price type is recorded.
      setValue("priceType", "");
      setValue("festivalName", "");
      setPkgPriceNote(r.mode === "INSPECTION" ? "Price on inspection — site inspection required (no package price)" : "");
      return;
    }
    const isFestival = !!festival && festival.prices[item.contentId] != null;
    setValue("priceType", isFestival ? "FESTIVAL" : "REGULAR");
    setValue("festivalName", isFestival ? festival!.name : "");
    setPkgPriceNote(`${item.name} — ${isFestival ? `${festival!.name} price` : "Regular price"} ${formatINR(price)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePricing, homeCategory, homeVariant, homePackage, homeDate]);
  // A staff-typed estimate on a selection that needs inspection stays, with a clear warning.
  const inspectionSelected = homeCategory === "HOME_DEEP_CLEANING" && needsInspection(homeVariant);

  // Opened from a customer page (+ New Lead): look the contact up straight away.
  useEffect(() => {
    if (!leadId && defaultValues?.mobile) handleMobileBlur(defaultValues.mobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(values: LeadFormValues) {
    setSubmitting(true);
    // Fold the dynamic quantity/size selections (Sofa seats, Mattress size,
    // Bathroom/Kitchen/Carpet/Window/Curtain quantity, Painting rooms/sq ft/
    // putty, Pest property size, Housekeeping staff/hours) into Notes — same
    // composition the public booking form uses — so nothing the staff
    // selected is lost even though Lead has no dedicated columns for them.
    // Inspection-only properties (4 BHK+, villa, bungalow, …) are flagged in the notes so follow-up staff see it.
    const needsInspectionHere = (values.serviceCategory || "HOME_DEEP_CLEANING") === "HOME_DEEP_CLEANING" && needsInspection(values.serviceVariant);
    const inspectionLine =
      needsInspectionHere && !/SITE INSPECTION REQUIRED/i.test(values.notes ?? "")
        ? "SITE INSPECTION REQUIRED — no package price; final quote after inspection."
        : "";
    // A staff-typed figure on an inspection-only property is provisional, never a confirmed quote.
    const provisionalLine =
      needsInspectionHere && Number(values.quoteAmount) > 0 && !/provisional/i.test(values.notes ?? "")
        ? `Estimate ${formatINR(Number(values.quoteAmount))} is PROVISIONAL — pending site inspection (not a confirmed quote).`
        : "";
    const mergedNotes = [values.notes?.trim(), inspectionLine, provisionalLine, isCustomized ? "" : selectionNotesLines.join("\n")].filter(Boolean).join("\n\n");
    const finalValues = { ...values, notes: mergedNotes };
    let res = leadId
      ? await updateLead(leadId, finalValues, { serviceDate: defaultValues?.serviceDate ?? "", timeSlot: defaultValues?.timeSlot ?? "" })
      : await createLead(finalValues);
    // Same customer + service + date + slot + site → confirm before saving a second enquiry.
    if (!leadId && "duplicateWarning" in res && res.duplicateWarning) {
      if (!window.confirm(res.duplicateWarning)) {
        setSubmitting(false);
        return;
      }
      res = await createLead(finalValues, { allowDuplicate: true });
    }
    setSubmitting(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    const autoQuote = !leadId && "quoteNumber" in res && res.quoteNumber ? res.quoteNumber : null;
    toast.success(leadId ? "Lead updated" : autoQuote ? `Lead created — quotation ${autoQuote} ready` : "Lead created");
    router.push(leadId ? `/leads/${leadId}` : `/leads/${"leadId" in res ? res.leadId : leadId}${book ? "?confirm=1" : ""}`); // push already loads fresh data (dynamic page) — no second refresh render
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Customer Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Customer Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile">Mobile</Label>
        <Input
                    id="mobile"
          {...register("mobile")}
                    placeholder="9876543210"
                    inputMode="tel"
                    onBlur={(e) => {
                                  register("mobile").onBlur(e);
                                  handleMobileBlur(e.target.value);
                    }}
                  />
            {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
            {checkingRepeat && <p className="text-xs text-muted-foreground">Checking customer history…</p>}
            {repeatCustomer && (
              <div className="space-y-1.5 rounded-md border border-primary/30 bg-primary/5 p-2.5">
                <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-primary">
                  Existing customer{repeatCustomer.name ? ` — ${repeatCustomer.name}` : ""}
                  <ContactTypeBadge type={repeatCustomer.contactType} />
                  {repeatCustomer.isRepeat && <RepeatBadge partner={repeatCustomer.contactType !== "CUSTOMER"} />}
                </p>
                <p className="text-xs text-muted-foreground">
                  {repeatCustomer.jobCount} previous job{repeatCustomer.jobCount === 1 ? "" : "s"}
                  {repeatCustomer.lastServiceDate ? ` · Last service: ${formatDate(repeatCustomer.lastServiceDate)}` : ""}
                  {/* Revenue only for Super Admin / Accounts — see getRepeatCustomerSummary. */}
                  {repeatCustomer.totalRevenue !== null ? ` · Lifetime value: ${formatINR(repeatCustomer.totalRevenue)}` : ""}
                </p>
                {!leadId && (
                  <Button type="button" size="sm" variant="outline" className="h-8" onClick={applyExistingCustomer}>
                    <Check className="size-3.5" /> Use customer
                  </Button>
                )}
              </div>
            )}
          </div>
          <More title="More customer details" hint="alternate no. · email · contact type" open={!!(defaultValues?.alternateMobile || defaultValues?.email)}>
          <div className="space-y-1.5">
            <Label htmlFor="alternateMobile">Alternate Mobile (optional)</Label>
            <Input id="alternateMobile" {...register("alternateMobile")} placeholder="Second number" inputMode="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" type="email" {...register("email")} placeholder="name@example.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          {!leadId && (
            <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="contactType">Contact Type</Label>
                <select
                  id="contactType"
                  value={watch("contactType") || "CUSTOMER"}
                  onChange={(e) => setValue("contactType", e.target.value, { shouldDirty: true })}
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value="CUSTOMER">Customer</option>
                  <option value="BROKER">Broker</option>
                  <option value="ARCHITECT">Architect</option>
                  <option value="INTERIOR_DESIGNER">Interior Designer</option>
                  <option value="SOCIETY">Society / Facility</option>
                  <option value="CORPORATE">Corporate / Other</option>
                </select>
              </div>
              <label className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium">
                <Checkbox checked={!!watch("isRepeat")} onCheckedChange={(v) => setValue("isRepeat", !!v, { shouldDirty: true })} />
                Repeat customer
              </label>
            </div>
          )}
          </More>
          {!leadId && repeatCustomer?.sites && repeatCustomer.sites.length > 0 && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Service Site</Label>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {repeatCustomer.sites.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => chooseSite(site.id)}
                    className={`flex items-start gap-2 rounded-md border p-2 text-left text-xs ${siteChoice === site.id ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "hover:border-primary/40"}`}
                  >
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{site.label || "Site"}{site.area ? ` · ${site.area}` : ""}</span>
                      <span className="line-clamp-2 text-muted-foreground">{site.address}</span>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => chooseSite("NEW")}
                  className={`flex items-center justify-center gap-1.5 rounded-md border border-dashed p-2 text-xs font-semibold ${siteChoice === "NEW" ? "border-primary text-primary" : "text-muted-foreground"}`}
                >
                  <Plus className="size-3.5" /> New site (enter address below)
                </button>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pinCode">PIN Code</Label>
            <Input id="pinCode" {...register("pinCode")} placeholder="411028" inputMode="numeric" maxLength={6} />
            {errors.pinCode && <p className="text-xs text-destructive">{errors.pinCode.message}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Full Address</Label>
            <Textarea id="address" {...register("address")} rows={2} placeholder="Flat / house no, building, street, landmark, area" />
          </div>
          <div className="sm:col-span-2">
            <MapsLocationInput
              apiKey={mapsApiKey}
              value={{
                mapLink: watch("mapLink") || "",
                lat: parseMapLink(watch("mapLink"))?.lat ?? null,
                lng: parseMapLink(watch("mapLink"))?.lng ?? null,
              }}
              onChange={(next) => setValue("mapLink", next.mapLink, { shouldDirty: true })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Service, Package &amp; Schedule</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ServiceCategoryPicker
              category={watch("serviceCategory") || "HOME_DEEP_CLEANING"}
              variant={watch("serviceVariant") || ""}
              packageName={watch("packageName") || ""}
              onCategoryChange={(v) => {
                setValue("serviceCategory", v);
                setValue("serviceVariant", "");
                setValue("packageName", "");
                setValue("service", (SERVICE_CATEGORY_TO_LEGACY[v] ?? "HOME_DEEP_CLEANING") as LeadFormValues["service"]);
                // Leaving Customized Service clears its package (nothing hidden is saved).
                if (v !== "CUSTOMIZER_PACKAGE" && pkg.lines.length) applyPkg({ lines: [], discount: 0 });
              }}
              hideVariant={(watch("serviceCategory") || "") === "CUSTOMIZER_PACKAGE"}
              onVariantChange={(v) => {
                setValue("serviceVariant", v);
                // Home Deep Cleaning: the picker's second field is the Property Type.
                if ((watch("serviceCategory") || "HOME_DEEP_CLEANING") === "HOME_DEEP_CLEANING") setValue("propertyType", v);
              }}
              onPackageChange={(v) => setValue("packageName", v)}
            />
          </div>
          {isCustomized && (
            <div className="sm:col-span-2">
              <PackageCalculator value={pkg} onChange={applyPkg} canEditPrice={canEditPricing} />
            </div>
          )}
{!isCustomized && (
          <div className="sm:col-span-2">
            <ServiceQuantityFields
              key={`${watch("serviceCategory") || ""}-${watch("serviceVariant") || ""}`}
              category={watch("serviceCategory") || ""}
              variant={watch("serviceVariant") || ""}
              initialSelectionNotes={leadId ? defaultValues?.notes : undefined}
              onEstimate={(amt) => {
                if (amt > 0 && !estimateTouched) setValue("quoteAmount", amt, { shouldDirty: true });
              }}
              onNotesLines={setSelectionNotesLines}
            />
          </div>
          )}
          <More title="Lead source & marketing" hint={LEAD_SOURCE_OPTIONS.find((o) => o.value === watch("source"))?.label}>
          <div className="space-y-1.5">
            <Label>Lead Source</Label>
            <Select value={watch("source")} onValueChange={(v) => setValue("source", v as LeadFormValues["source"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!leadId && (
            <>
              <div className="space-y-1.5">
                <Label>Marketing channel</Label>
                <Select value={watch("acquisitionChannel") || "AUTO"} onValueChange={(v) => setValue("acquisitionChannel", v === "AUTO" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Auto from Lead Source</SelectItem>
                    {ACQUISITION_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acquisitionCampaign">Campaign (optional)</Label>
                <Input id="acquisitionCampaign" {...register("acquisitionCampaign")} placeholder="e.g. sahara_festival_2026" />
              </div>
            </>
          )}
          </More>
          <div className="space-y-1.5">
            <Label htmlFor="quoteAmount">Estimated Amount (₹)</Label>
            <Input
              id="quoteAmount"
              type="number"
              {...quoteAmountField}
              onChange={(e) => {
                quoteAmountField.onChange(e);
                setEstimateTouched(true);
              }}
              placeholder="As per pricing master"
            />
            {pkgPriceNote && <p className="text-xs text-muted-foreground">{pkgPriceNote}{estimateTouched ? " · amount edited by hand" : ""}</p>}
            {pkgPrice != null && estimated > 0 && estimated !== pkgPrice && (
              <p className="rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-900" role="note">
                Custom quote active ({formatINR(estimated)}). Changing the property type or package will NOT recalculate it.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    autoEstimateRef.current = pkgPrice;
                    setEstimateTouched(false);
                    setValue("quoteAmount", pkgPrice, { shouldDirty: true });
                  }}
                >
                  Reset to package price ({formatINR(pkgPrice)})
                </button>
              </p>
            )}
            {inspectionSelected && estimated > 0 && (
              <p className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900" role="alert">
                Manual staff estimate — not a package price. This property needs a site inspection; the final quote is confirmed only after inspection.
              </p>
            )}
          </div>

          <More title="Advance / payment" hint={advReceived > 0 ? `advance ${formatINR(advReceived)}` : "none recorded"} open={advReceived > 0}>
          <div className="space-y-2 sm:col-span-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Advance Received (₹)</Label>
                <Input type="number" {...register("advanceAmount")} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Balance</Label>
                <div className="flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium">
                  {formatINR(leadBalance)}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mode</Label>
                <Select
                  value={watch("paymentMode") || "NONE"}
                  onValueChange={(v) => setValue("paymentMode", v === "NONE" ? "" : (v as LeadFormValues["paymentMode"]), { shouldDirty: true })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">—</SelectItem>
                    {PAYMENT_MODES.map((m) => (
                      <SelectItem key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment Status</Label>
              <Select
                value={watch("paymentStatus") || "PENDING"}
                onValueChange={(v) => setValue("paymentStatus", v as LeadFormValues["paymentStatus"], { shouldDirty: true })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{LEAD_PAYMENT_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          </More>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div className="space-y-1.5">
              <Label htmlFor="serviceDate">Requested Service Date</Label>
              <DateInput id="serviceDate" {...register("serviceDate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Time Slot</Label>
              <Select
                value={watch("timeSlot") || "NONE"}
                onValueChange={(v) => setValue("timeSlot", v === "NONE" ? "" : v, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Any</SelectItem>
                  {/* Keep an older (pre-2-hour) slot visible on existing leads. */}
                  {watch("timeSlot") && !(TIME_SLOTS as readonly string[]).includes(watch("timeSlot") ?? "") && (
                    <SelectItem value={watch("timeSlot")!}>{watch("timeSlot")}</SelectItem>
                  )}
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
            <Label htmlFor="followUpDate">Follow-up Date</Label>
            <DateInput id="followUpDate" {...register("followUpDate")} />
          </div>
          <TeamSelect
            value={watch("teamNumber")}
            onChange={(v) => setValue("teamNumber", v)}
          />
          <More
            title="Assignment, scope & notes"
            hint={[assignedStaffIds.length ? `${assignedStaffIds.length} staff` : "", watch("scopeOfWork") ? "scope" : "", watch("notes") ? "notes" : ""].filter(Boolean).join(" · ") || undefined}
            open={!!(defaultValues?.scopeOfWork || defaultValues?.notes)}
          >
          <div className="space-y-1.5">
            <Label>Assigned To</Label>
            <Select
              value={watch("assignedToId") || "NONE"}
              onValueChange={(v) => setValue("assignedToId", v === "NONE" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Unassigned</SelectItem>
                {userOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Assign Staff (multiple)</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {staffOptions.length === 0 ? (
                <p className="px-1 py-1 text-sm text-muted-foreground">No active staff</p>
              ) : (
                staffOptions.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
                    <Checkbox checked={assignedStaffIds.includes(s.id)} onCheckedChange={() => toggleStaff(s.id)} />
                    {s.name} <span className="text-xs text-muted-foreground">({s.designation})</span>
                  </label>
                ))
              )}
            </div>
            {assignedStaffIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Assigned: {assignedStaffIds.map((id) => staffOptions.find((s) => s.id === id)?.name).filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="scopeOfWork">Scope of work (shown to the assigned team)</Label>
            <Textarea id="scopeOfWork" {...register("scopeOfWork")} rows={3} placeholder="Exact package / rooms / items agreed with the customer" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} rows={3} />
          </div>
          </More>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-2.5 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          {leadId ? "Save changes" : book ? "Save & confirm booking" : "Create lead"}
        </Button>
      </div>
    </form>
  );
}

/**
 * New Lead page wrapper: picks up a package handed over from the header
 * Package Calculator ("New lead with this package") and starts the form as a
 * Customized Service with those services. Read once after mount (no SSR mismatch).
 */
export function NewLeadForm({ prefill, ...props }: Omit<Parameters<typeof LeadForm>[0], "defaultValues" | "leadId"> & { prefill?: { name?: string; mobile?: string } }) {
  const [draft, setDraft] = useState<PackageDraft | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("sahara_pkg_draft");
      if (!raw) return;
      sessionStorage.removeItem("sahara_pkg_draft");
      const d = JSON.parse(raw) as PackageDraft;
      if (d?.lines?.length) setDraft(d);
    } catch {
      /* storage unavailable */
    }
  }, []);
  if (!draft) return <LeadForm {...props} defaultValues={prefill?.mobile ? { name: prefill.name ?? "", mobile: prefill.mobile } : undefined} />;
  const t = packageTotals(draft);
  return (
    <LeadForm
      key="with-package"
      {...props}
      defaultValues={{
        serviceCategory: "CUSTOMIZER_PACKAGE",
        service: (SERVICE_CATEGORY_TO_LEGACY.CUSTOMIZER_PACKAGE ?? "HOUSEKEEPING") as LeadFormValues["service"],
        serviceItems: serializeLines(draft),
        discountAmount: t.discount,
        quoteAmount: t.final,
        serviceVariant: draft.lines.length > 1 ? `${draft.lines[0].name} + ${draft.lines.length - 1} more` : draft.lines[0].name,
      }}
    />
  );
}
