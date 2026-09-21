import { type ReactNode } from "react";
import { SidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";
import { CustomerActionsBar } from "./customer-actions-bar";
import { Toaster } from "@/components/ui/sonner";
import { canAccess } from "@/lib/constants";

export function AppShell({
  name,
  role,
  logoUrl,
  children,
}: {
  name: string;
  role: string;
  logoUrl?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col">
        <SidebarNav role={role} logoUrl={logoUrl} />
      </div>
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar name={name} role={role} logoUrl={logoUrl} />
        {canAccess(role, "customers") && <CustomerActionsBar />}
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
