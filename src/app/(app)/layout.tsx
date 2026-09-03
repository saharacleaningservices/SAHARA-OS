import { type ReactNode } from "react";
import { requireUser } from "@/lib/current-user";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireUser();

  return (
    <AppShell name={session.name} role={session.role}>
      {children}
    </AppShell>
  );
}
