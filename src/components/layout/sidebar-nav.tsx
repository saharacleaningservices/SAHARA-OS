"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-config";
import { canAccess } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export function SidebarNav({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => canAccess(role, item.section));

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">Sahara OS</p>
          <p className="text-[11px] text-sidebar-foreground/70 leading-tight">Sahara Cleaning Services</p>
        </div>
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
