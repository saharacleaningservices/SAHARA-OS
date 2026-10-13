import { CompanyLogo } from "@/components/shared/company-logo";
import { StaffRegisterForm } from "@/components/auth/staff-register-form";
import { getCompanySettings } from "@/server/settings";

// DB read per request (logo) — never prerender at build (no DB in the build container).
export const dynamic = "force-dynamic";
export const metadata = { title: "Staff App registration — Sahara Staff", manifest: "/staff.webmanifest" };

export default async function StaffRegisterPage() {
  const settings = await getCompanySettings();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <CompanyLogo logoUrl={settings.logoUrl} className="h-10 w-auto" />
      <div className="text-center">
        <h1 className="text-lg font-semibold">Register for the Staff App</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use the mobile number the office has on your staff record.</p>
      </div>
      <StaffRegisterForm />
    </div>
  );
}
