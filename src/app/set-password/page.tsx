import { redirect } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { CompanyLogo } from "@/components/shared/company-logo";
import { getCompanySettings } from "@/server/settings";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export const metadata = { title: "Set a new password — Sahara OS" };

export default async function SetPasswordPage() {
  const session = await requireUser();
  if (session.role === "STAFF") redirect("/my/account"); // staff change their PIN in the Staff App
  const [account, settings] = await Promise.all([
    db.user.findUnique({ where: { id: session.sub }, select: { mustChangePassword: true } }),
    getCompanySettings(),
  ]);
  if (!account?.mustChangePassword) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <CompanyLogo logoUrl={settings.logoUrl} className="h-10 w-auto" />
          <h1 className="text-lg font-semibold text-foreground">Set your own password</h1>
          <p className="text-sm text-muted-foreground">
            Choose your own password before you continue. It can be simple if you like — at least 6 characters, and
            different from the temporary one you were given.
          </p>
        </div>
        <SetPasswordForm />
      </div>
    </div>
  );
}
