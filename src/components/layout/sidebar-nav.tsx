"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { NAV_GROUPS, NAV_ITEMS } from "./nav-config";
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
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  // Accordion: five groups instead of one 30+ item list. Empty groups (nothing the role may open) are hidden;
  // the group of the current page is always open, the first group is open by default.
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: items.filter((i) => i.group === g.key) })).filter((g) => g.items.length > 0);
  const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.href)))?.key;
  const [open, setOpen] = useState<Set<string>>(() => new Set([activeGroup ?? groups[0]?.key ?? ""]));
  useEffect(() => {
    if (activeGroup) setOpen((prev) => (prev.has(activeGroup) ? prev : new Set(prev).add(activeGroup)));
  }, [activeGroup]);
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        {/* Always resolves through CompanyLogo: real /brand logo once uploaded,
            else the admin-uploaded Settings logo, else the bundled placeholder
            mark — so the sidebar always matches every other surface. */}
        <span className="rounded-lg bg-white/95 px-2.5 py-1.5">
          <CompanyLogo logoUrl={logoUrl} className="h-9 w-auto max-w-[180px]" showTm />
        </span>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2" aria-label="Main navigation">
        {groups.map((g) => {
          const isOpen = open.has(g.key);
          return (
            <div key={g.key} className="rounded-xl">
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={isOpen}
                aria-controls={`nav-group-${g.key}`}
                className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <span>{g.label}</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-sidebar-accent px-1.5 text-[10px] font-medium normal-case tracking-normal text-sidebar-foreground/70">{g.items.length}</span>
                  <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                </span>
              </button>
              {isOpen && (
                <div id={`nav-group-${g.key}`} className="mt-0.5 space-y-0.5">
                  {g.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
                </div>
              )}
            </div>
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
