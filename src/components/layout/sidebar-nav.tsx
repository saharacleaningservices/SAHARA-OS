"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-config";
import { CompanyLogo } from "@/components/shared/company-logo";
import { canAccess } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function SidebarNav({
  role,
  logoUrl,
  onNavigate,
}: {
  role: string;
  logoUrl?: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => canAccess(role, item.section));

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        {logoUrl ? (
          <span className="rounded-lg bg-white/95 px-2.5 py-1.5">
            <CompanyLogo logoUrl={logoUrl} className="h-7 w-auto max-w-[180px]" />
          </span>
        ) : (
          <>
            {/* Square app-icon mark — bundled /icon.svg (also the favicon). */}
            <img src="/icon.svg" alt="" aria-hidden className="size-9 rounded-lg" />
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Sahara OS</p>
              <p className="text-[11px] text-sidebar-foreground/70 leading-tight">Sahara Cleaning Services</p>
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-4 rounded-lg bg-sidebar-accent/60 p-3 text-[11px] leading-relaxed text-sidebar-foreground/70">
        <p className="font-semibold text-sidebar-foreground">Need help?</p>
        <p>Call {`→`} 7083347130</p>
        <p>Opp. South Gate, Magarpatta City</p>
      </div>
    </div>
  );
}
