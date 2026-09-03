"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu, LogOut, User as UserIcon, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { NAV_ITEMS } from "./nav-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";

export function Topbar({
  name,
  role,
}: {
  name: string;
  role: string;
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav role={role} onNavigate={() => setOpen(false)} />
        </SheetContent>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
          <Menu />
        </Button>
      </Sheet>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground sm:text-base">
          {pageLabel ?? "Sahara OS"}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar>
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
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
          <DropdownMenuItem disabled>
            <UserIcon /> My Profile
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Settings /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
            <LogOut /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
