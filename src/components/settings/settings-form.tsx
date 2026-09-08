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

  async function handleLogoUpload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "logo");
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed");
        return;
      }
      setValue("logoUrl", json.url, { shouldDirty: true });
      toast.success("Logo uploaded — save to apply");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

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
              Shown to customers after job completion (review request WhatsApp message + confirmation page).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <CompanyLogo logoUrl={logoUrl} className="h-12 w-auto max-w-[220px]" />
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
            This custom logo shows in the header. The sidebar icon, login page, browser favicon and app icon always
            use Sahara OS&apos;s built-in mark, so they stay reliable even if this upload is ever lost — and if it
            ever fails to load, the header falls back to the built-in mark automatically rather than showing a
            broken image.
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
