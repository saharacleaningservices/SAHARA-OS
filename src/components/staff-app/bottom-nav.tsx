"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Wallet, QrCode, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/my", label: "Home", icon: Home, match: (p: string) => p === "/my" },
  { href: "/my/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/my/calendar") || p.startsWith("/my/day") },
  { href: "/my/records", label: "My Records", icon: Wallet, match: (p: string) => p.startsWith("/my/records") },
  { href: "/my/tools", label: "Customer", icon: QrCode, match: (p: string) => p.startsWith("/my/tools") },
  { href: "/my/alerts", label: "Alerts", icon: Bell, match: (p: string) => p.startsWith("/my/alerts") || p.startsWith("/my/announcements") },
];

export function StaffBottomNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Staff app"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-5" />
                {label}
                {href === "/my/alerts" && unread > 0 && (
                  <span className="absolute right-[calc(50%-18px)] top-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
