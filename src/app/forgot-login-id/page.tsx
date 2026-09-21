import { ForgotLoginIdForm } from "@/components/auth/forgot-login-id-form";
import { CompanyLogo } from "@/components/shared/company-logo";
import { COMPANY } from "@/lib/constants";
import { getCompanySettings } from "@/server/settings";
import { ShieldCheck } from "lucide-react";

// This page must never be statically prerendered at build time: it calls
// getCompanySettings() (a DB read) on every render, and the build
// container has no database available (only the runtime container does).
export const dynamic = "force-dynamic";

export default async function ForgotLoginIdPage() {
  const settings = await getCompanySettings();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-secondary p-10 text-white lg:flex sahara-gradient">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-white/95 px-3 py-2">
            <CompanyLogo logoUrl={settings.logoUrl} className="h-8 w-auto max-w-[200px]" showTm />
          </span>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">Forgot which number you signed up with?</h1>
          <p className="max-w-md text-white/80">
            Tell us your name and the Super Admin will call you with your registered mobile number or email.
          </p>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <ShieldCheck className="size-4" />
            Owner-verified for every team member
          </div>
        </div>

        <p className="text-xs text-white/60">
          {COMPANY.address} · {COMPANY.phones.join(" / ")}
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-8 p-6 sm:p-10">
        <div className="flex flex-col items-center gap-2 lg:hidden">
          <CompanyLogo logoUrl={settings.logoUrl} className="h-[52px] w-auto max-w-[200px]" showTm />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-6 space-y-1 text-center lg:text-left">
            <h2 className="text-xl font-semibold text-foreground">Forgot Login ID</h2>
            <p className="text-sm text-muted-foreground">Your login ID is your mobile number or email — we&apos;ll help you find it</p>
          </div>
          <ForgotLoginIdForm />
        </div>
      </div>
    </div>
  );
}
