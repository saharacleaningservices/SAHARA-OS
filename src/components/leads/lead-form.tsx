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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { leadSchema, type LeadFormValues } from "@/lib/validation";
import { LEAD_SOURCE_OPTIONS, SERVICE_CATEGORY_TO_LEGACY, TIME_SLOTS } from "@/lib/constants";
import { createLead, updateLead } from "@/server/actions/leads";
import { ServiceCategoryPicker } from "@/components/shared/service-category-picker";
import { MapsLocationInput } from "@/components/shared/maps-location-input";
import { parseMapLink } from "@/lib/maps";
import { TeamSelect } from "@/components/shared/team-select";

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
      service: "HOME_DEEP_CLEANING",
      source: "CALL",
      followUpDate: "",
      serviceDate: "",
      timeSlot: "",
      teamNumber: "",
      assignedStaffId: "",
      assignedToId: "",
      notes: "",
      serviceCategory: "HOME_DEEP_CLEANING",
      serviceVariant: "",
      mapLink: "",
      ...defaultValues,
    },
  });

  async function onSubmit(values: LeadFormValues) {
    setSubmitting(true);
    const res = leadId ? await updateLead(leadId, values) : await createLead(values);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(leadId ? "Lead updated" : "Lead created");
    router.push(leadId ? `/leads/${leadId}` : `/leads/${res.leadId}`);
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
            <Input id="mobile" {...register("mobile")} placeholder="9876543210" inputMode="tel" />
            {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
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
            <Label htmlFor="area">Area</Label>
            <Input id="area" {...register("area")} placeholder="e.g. Magarpatta City" />
            {errors.area && <p className="text-xs text-destructive">{errors.area.message}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Full Address</Label>
            <Textarea id="address" {...register("address")} rows={2} />
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
              onCategoryChange={(v) => {
                setValue("serviceCategory", v);
                setValue("serviceVariant", "");
                setValue("service", (SERVICE_CATEGORY_TO_LEGACY[v] ?? "HOME_DEEP_CLEANING") as LeadFormValues["service"]);
              }}
              onVariantChange={(v) => setValue("serviceVariant", v)}
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
          <div className="space-y-1.5">
            <Label htmlFor="quoteAmount">Estimated Amount (₹)</Label>
            <Input id="quoteAmount" type="number" {...register("quoteAmount")} placeholder="Minimum ₹3,999" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div className="space-y-1.5">
              <Label htmlFor="serviceDate">Requested Service Date</Label>
              <Input id="serviceDate" type="date" {...register("serviceDate")} />
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
            <Input id="followUpDate" type="date" {...register("followUpDate")} />
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
          <div className="space-y-1.5">
            <Label>Assign to Staff</Label>
            <Select
              value={watch("assignedStaffId") || "NONE"}
              onValueChange={(v) => setValue("assignedStaffId", v === "NONE" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Unassigned</SelectItem>
                {staffOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.designation})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
