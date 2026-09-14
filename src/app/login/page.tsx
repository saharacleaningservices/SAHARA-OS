import { LoginForm } from "@/components/auth/login-form";
import { CompanyLogo } from "@/components/shared/company-logo";
import { COMPANY } from "@/lib/constants";
import { getCompanySettings } from "@/server/settings";
import { ShieldCheck } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, settings] = await Promise.all([searchParams, getCompanySettings()]);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-secondary p-10 text-white lg:flex sahara-gradient">
        <div className="flex items-center gap-2">
          {/* Always resolves through CompanyLogo (real /brand logo → admin
              upload → bundled placeholder) so login always matches every
              other surface, with the same TM mark treatment. */}
          <span className="rounded-lg bg-white/95 px-3 py-2">
            <CompanyLogo logoUrl={settings.logoUrl} className="h-8 w-auto max-w-[200px]" showTm />
          </span>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            The operating system behind {COMPANY.name}.
          </h1>
          <p className="max-w-md text-white/80">
            Leads, jobs, staff, payments and profit — one place to run home deep cleaning,
            commercial cleaning, housekeeping, pest control and interior painting jobs across Pune.
          </p>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <ShieldCheck className="size-4" />
            Role-based access for Admin, Operations, Accounts, Supervisor & Staff
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
            <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in with your mobile number and password</p>
          </div>
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
