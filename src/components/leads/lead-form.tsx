"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { leadSchema, type LeadFormValues } from "@/lib/validation";
import { LEAD_SOURCE_OPTIONS, SERVICE_CATEGORY_TO_LEGACY } from "@/lib/constants";
import { createLead, updateLead } from "@/server/actions/leads";
import { ServiceCategoryPicker } from "@/components/shared/service-category-picker";
import { ShareLocationButton } from "@/components/shared/share-location-button";

type StaffOption = { id: string; name: string; designation: string };
type UserOption = { id: string; name: string; role: string };

export function LeadForm({
  staffOptions,
  userOptions,
  defaultValues,
  leadId,
}: {
  staffOptions: StaffOption[];
  userOptions: UserOption[];
  defaultValues?: Partial<LeadFormValues>;
  leadId?: string;
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
      whatsapp: "",
      address: "",
      area: "",
      service: "HOME_DEEP_CLEANING",
      source: "CALL",
      followUpDate: "",
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
            <Input id="mobile" {...register("mobile")} placeholder="9876543210" />
            {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp (if different)</Label>
            <Input id="whatsapp" {...register("whatsapp")} placeholder="Same as mobile" />
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Location</Label>
            <div className="flex flex-wrap items-center gap-2">
              <ShareLocationButton onShare={async (link) => { setValue("mapLink", link); return { success: true }; }} />
              {watch("mapLink") && (
                <a
                  href={watch("mapLink")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <MapPin className="size-3" /> Location captured
                </a>
              )}
            </div>
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
          <div className="space-y-1.5">
            <Label htmlFor="followUpDate">Follow-up Date</Label>
            <Input id="followUpDate" type="date" {...register("followUpDate")} />
          </div>
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
