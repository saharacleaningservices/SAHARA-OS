"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyLogo } from "@/components/shared/company-logo";
import { companySettingsSchema, type CompanySettingsFormValues } from "@/lib/validation";
import { updateCompanySettings } from "@/server/actions/settings";

export function SettingsForm({ defaultValues }: { defaultValues: CompanySettingsFormValues }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues,
  });

  const logoUrl = watch("logoUrl");
  const upiQrUrl = watch("upiQrUrl");

  async function handleUpload(file: File, folder: "logo" | "company-docs", field: "logoUrl" | "upiQrUrl", label: string) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed");
        return;
      }
      setValue(field, json.url, { shouldDirty: true });
      toast.success(`${label} uploaded — save to apply`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }
  const handleLogoUpload = (file: File) => handleUpload(file, "logo", "logoUrl", "Logo");

  async function onSubmit(values: CompanySettingsFormValues) {
    setSubmitting(true);
    const res = await updateCompanySettings(values);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Company settings saved");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Company Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register("phone")} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" placeholder="www.saharacleaningservices.com" {...register("website")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" rows={2} {...register("address")} />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="googleReviewUrl">Google Review Link (optional)</Label>
            <Input id="googleReviewUrl" placeholder="https://g.page/r/.../review" {...register("googleReviewUrl")} />
            <p className="text-xs text-muted-foreground">
              Opened by the &ldquo;View Google Reviews&rdquo; buttons on the booking page and after job completion.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="googleRating">Google Rating</Label>
            <Input id="googleRating" placeholder="4.9" {...register("googleRating")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="googleReviewCount">Google Review Count</Label>
            <Input id="googleReviewCount" placeholder="1800+" {...register("googleReviewCount")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="happyCustomers">Happy Customers</Label>
            <Input id="happyCustomers" placeholder="8000+" {...register("happyCustomers")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="featuredReviews">Featured Reviews (booking-page carousel)</Label>
            <Textarea
              id="featuredReviews"
              rows={4}
              placeholder='[{"name":"Priya S.","text":"Excellent deep cleaning, team was on time.","rating":5}]'
              {...register("featuredReviews")}
            />
            <p className="text-xs text-muted-foreground">
              JSON array of {`{ name, text, rating }`}. Leave blank to show just the rating + &ldquo;View all&rdquo; button.
              Live Google Business Profile sync is planned separately.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Collection</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Shown to customers on quotations, invoices and the booking page. Every field is optional — the QR works on its own.
            After uploading a QR, press Save Settings.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="upiId">UPI ID <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="upiId" placeholder="sahara@okhdfcbank" {...register("upiId")} />
          </div>
          <div className="space-y-1.5">
            <Label>Payment QR image <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <div className="flex items-center gap-3">
              {upiQrUrl ? (
                <img src={upiQrUrl} alt="QR" className="size-14 rounded border border-border object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">No QR uploaded</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => document.getElementById("qr-file")?.click()}
              >
                {uploading ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />}
                {upiQrUrl ? "Replace QR" : "Upload QR"}
              </Button>
              {upiQrUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setValue("upiQrUrl", "", { shouldDirty: true })}>
                  Remove
                </Button>
              )}
              <input
                id="qr-file"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f, "company-docs", "upiQrUrl", "QR");
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankAccountName">Bank Account Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="bankAccountName" {...register("bankAccountName")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankAccountNumber">Account Number</Label>
            <Input id="bankAccountNumber" {...register("bankAccountNumber")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankIfsc">IFSC</Label>
            <Input id="bankIfsc" {...register("bankIfsc")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankName">Bank Name</Label>
            <Input id="bankName" {...register("bankName")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <CompanyLogo logoUrl={logoUrl} className="h-12 w-auto max-w-[220px]" showTm />
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => document.getElementById("logo-file")?.click()}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />}
              Upload New Logo
            </Button>
            <input
              id="logo-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">PNG, JPG or SVG · up to 8MB</p>
          </div>
          <p className="text-xs text-muted-foreground">
            This logo now appears everywhere — sidebar, header, login page, booking page, footer, browser
            favicon and app icon — right after the official file at <code>/brand/sahara-logo.png</code> if
            that has been added (that one always wins when present). If this upload is ever lost, missing or
            fails to load, every surface falls back to the built-in Sahara mark automatically, so nothing
            ever shows a broken image.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || uploading}>
          {submitting && <Loader2 className="animate-spin" />}
          Save Settings
        </Button>
      </div>
    </form>
  );
}
