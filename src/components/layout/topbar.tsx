"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, LogOut, User as UserIcon, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { CompanyLogo } from "@/components/shared/company-logo";
import { NAV_ITEMS } from "./nav-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "@/components/shared/global-search";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { EodSummaryModal } from "@/components/notifications/eod-summary-modal";
import { NewInquiryAlert } from "@/components/notifications/new-inquiry-alert";
import { ROLE_LABELS } from "@/lib/constants";
import { canSearchGlobally } from "@/lib/permissions";

export function Topbar({
  name,
  role,
  logoUrl,
}: {
  name: string;
  role: string;
  logoUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const pageLabel = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.label ?? "Sahara OS";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    // 56px on phones (more room for content), 64px from md up. The dashboard's sticky
    // tab bar (tabbed-dashboard.tsx) sits at top-14 / md:top-16 — keep the two in step.
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1.5 border-b border-border bg-card/95 px-2 backdrop-blur sm:px-4 md:h-16 md:gap-3 md:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav role={role} logoUrl={logoUrl} onNavigate={() => setOpen(false)} />
        </SheetContent>
        <Button variant="ghost" size="icon" className="size-11 rounded-xl md:size-9 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
          <Menu className="size-5" />
        </Button>
      </Sheet>

      {/* Brand logo on phones / tablets (owner 2026-10-18). Desktop (lg+) shows it in the sidebar. */}
      <Link href="/dashboard" className="flex min-h-11 shrink-0 select-none items-center lg:hidden" aria-label="Sahara OS home">
        <CompanyLogo logoUrl={logoUrl} className="h-8 w-auto max-w-[96px] sm:max-w-[120px]" />
      </Link>

      <div className="min-w-0 flex-1">
        {canSearchGlobally(role) ? (
          <GlobalSearch />
        ) : (
          // Phones show the wordmark instead; the page name returns from sm up.
          <p className="hidden truncate text-sm font-semibold text-foreground sm:block sm:text-base">
            {pageLabel ?? "Sahara OS"}
          </p>
        )}
      </div>
      {canSearchGlobally(role) && (
        <p className="hidden truncate text-sm font-semibold text-foreground md:block">{pageLabel}</p>
      )}

      {(role === "ACCOUNTS" || role === "OPERATIONS") && <NewInquiryAlert />}
      <NotificationsBell />
      {(role === "ADMIN" || role === "ACCOUNTS") && <EodSummaryModal />}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-1.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring md:min-h-0 md:py-1" aria-label="Account menu">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">
              {name.trim().charAt(0).toUpperCase() || <UserIcon className="size-4" />}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight text-foreground">{name}</span>
              <span className="block text-xs leading-tight text-muted-foreground">
                {ROLE_LABELS[role] ?? role}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="font-medium">{name}</p>
            <p className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[role] ?? role}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <UserIcon /> My Profile
            </Link>
          </DropdownMenuItem>
          {role === "ADMIN" && (
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
            <LogOut /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
