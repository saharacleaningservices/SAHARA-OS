import { type ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { getCompanySettings } from "@/server/settings";
import { AppShell } from "@/components/layout/app-shell";
import { db } from "@/lib/db";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [session, settings] = await Promise.all([requireUser(), getCompanySettings()]);

  // Force a policy-compliant password on first login (retires shared passwords).
  const account = await db.user.findUnique({
    where: { id: session.sub },
    select: { mustChangePassword: true },
  });
  // Field Staff keep their office-issued PIN until they choose to change it (Staff App rule).
  if (account?.mustChangePassword && session.role !== "STAFF") redirect("/set-password");

  return (
    <AppShell name={session.name} role={session.role} logoUrl={settings.logoUrl}>
      {children}
    </AppShell>
  );
}
