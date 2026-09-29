"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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

type StaffOption = { id: string; name: string; designation: string };
type UserOption = { id: string; name: string; role: string };

export function LeadForm({
  staffOptions,
  userOptions,
  defaultValues,
  leadId,
  mapsApiKey = null,
}: {
  staffOptions: StaffOption[];
  userOptions: UserOption[];
  defaultValues?: Partial<LeadFormValues>;
  leadId?: string;
  mapsApiKey?: string | null;
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
    }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
      ...defaultValues,
    },
  });

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

  async function onSubmit(values: LeadFormValues) {
    setSubmitting(true);
    // Fold the dynamic quantity/size selections (Sofa seats, Mattress size,
    // Bathroom/Kitchen/Carpet/Window/Curtain quantity, Painting rooms/sq ft/
    // putty, Pest property size, Housekeeping staff/hours) into Notes — same
    // composition the public booking form uses — so nothing the staff
    // selected is lost even though Lead has no dedicated columns for them.
    const mergedNotes = [values.notes?.trim(), selectionNotesLines.join("\n")].filter(Boolean).join("\n\n");
    const finalValues = { ...values, notes: mergedNotes };
    const res = leadId ? await updateLead(leadId, finalValues) : await createLead(finalValues);
    setSubmitting(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(leadId ? "Lead updated" : "Lead created");
    router.push(leadId ? `/leads/${leadId}` : `/leads/${"leadId" in res ? res.leadId : leadId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5">
                            <p className="text-xs font-semibold text-primary">
                                          Repeat Customer{repeatCustomer.name ? ` — ${repeatCustomer.name}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {repeatCustomer.jobCount} previous job{repeatCustomer.jobCount === 1 ? "" : "s"}
                              {repeatCustomer.lastServiceDate ? ` · Last service: ${formatDate(repeatCustomer.lastServiceDate)}` : ""}
                              {/* Revenue is a financial figure — omitted entirely (not just
                                  zeroed) for roles that shouldn't see it; see
                                  getRepeatCustomerSummary in customer-actions.ts. */}
                              {repeatCustomer.totalRevenue !== null ? ` · Total revenue: ${formatINR(repeatCustomer.totalRevenue)}` : ""}
                            </p>
                </div>
                  )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alternateMobile">Alternate Mobile (optional)</Label>
            <Input id="alternateMobile" {...register("alternateMobile")} placeholder="Second number" inputMode="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp (if different)</Label>
            <Input id="whatsapp" {...register("whatsapp")} placeholder="Same as mobile" inputMode="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" type="email" {...register("email")} placeholder="name@example.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Enquiry Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              }}
              onVariantChange={(v) => setValue("serviceVariant", v)}
              onPackageChange={(v) => setValue("packageName", v)}
            />
          </div>
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
              placeholder="Minimum ₹3,999"
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
            <p className="text-sm font-semibold text-foreground">Payment</p>
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
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">
            Requested date/slot are what the customer asked for — separate from the follow-up date below.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="followUpDate">Follow-up Date</Label>
            <DateInput id="followUpDate" {...register("followUpDate")} />
          </div>
          <TeamSelect
            value={watch("teamNumber")}
            onChange={(v) => setValue("teamNumber", v)}
          />
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
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          {leadId ? "Save changes" : "Create lead"}
        </Button>
      </div>
    </form>
  );
}
