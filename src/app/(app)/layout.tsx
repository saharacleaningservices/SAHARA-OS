import { type ReactNode } from "react";
import { requireUser } from "@/lib/current-user";
import { getCompanySettings } from "@/server/settings";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [session, settings] = await Promise.all([requireUser(), getCompanySettings()]);

  return (
    <AppShell name={session.name} role={session.role} logoUrl={settings.logoUrl}>
      {children}
    </AppShell>
  );
}
