"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, ChevronDown, Menu, MessageSquare, PackageSearch, X } from "lucide-react";
import type { NavMega } from "@/config/nav-menu";

/**
 * Right-hand sidebar menu (owner 2026-11-02, final): the four service categories as accordions (each opens with a link to its
 * category landing page, then every service), plus Blog and Contact. Clear hierarchy — 16 px category rows, 15 px service rows,
 * 48 px tap targets. Body scroll locks while open; Escape / backdrop closes. Rendered closed on the server (no layout shift).
 */
export function SidebarMenu({ groups }: { groups: NavMega[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [open]);
  const tab = open ? 0 : -1;
  const close = () => setOpen(false);

  return (
    <>
      <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="flex size-11 items-center justify-center rounded-xl border border-border text-[#0a2540] hover:bg-[#eef4fb]">
        <Menu className="size-6" />
      </button>
      <div className={`fixed inset-0 z-[60] bg-[#0a2540]/50 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={close} aria-hidden />
      <nav aria-label="Main" aria-hidden={!open} className={`fixed inset-y-0 right-0 z-[61] flex w-[88%] max-w-sm flex-col bg-[#f5f8fd] shadow-2xl transition-[transform,visibility] duration-300 ease-out ${open ? "visible translate-x-0" : "invisible translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-[#0a2540]/10 bg-white px-5 pb-3 pt-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0a2540]/50">Menu</p>
          <button type="button" aria-label="Close menu" onClick={close} tabIndex={tab} className="flex size-10 items-center justify-center rounded-full bg-[#eef4fb]"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <p className="px-2 pb-2 text-[11px] font-extrabold uppercase tracking-widest text-primary">Services</p>
          <ul className="space-y-1.5">
            {groups.map((g) => {
              const isOpen = expanded === g.id;
              return (
                <li key={g.id} className={`rounded-2xl ${isOpen ? "bg-white shadow-sm" : ""}`}>
                  <button type="button" aria-expanded={isOpen} tabIndex={tab} onClick={() => setExpanded(isOpen ? null : g.id)} className="flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl px-3 text-left text-base font-extrabold text-[#0a2540] hover:bg-[#eef4fb]">
                    <span>{g.label.replace(" (B2B)", "")}<span className="block text-xs font-medium text-[#0a2540]/55">{g.items.length} services</span></span>
                    <ChevronDown className={`size-5 shrink-0 text-primary transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <ul className="px-2 pb-3">
                      <li><Link href={g.href} onClick={close} tabIndex={tab} className="flex min-h-11 items-center justify-between rounded-xl px-3 text-[15px] font-bold text-primary hover:bg-white">View all {g.short} <ArrowRight className="size-4" /></Link></li>
                      {g.items.map((i) => (
                        <li key={i.href}><Link href={i.href} onClick={close} tabIndex={tab} className="flex min-h-11 items-center rounded-xl px-3 text-[15px] text-[#0a2540]/85 hover:bg-white hover:text-primary">{i.label}</Link></li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        {/* Bottom navigation container — dark blue theme (owner 2026-11-03); the top / services area stays light. */}
        <div className="space-y-1 bg-[#0a2540] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-white">
          <Link href="/track" onClick={close} tabIndex={tab} className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-base font-extrabold hover:bg-white/10"><PackageSearch className="size-5 text-amber-300" />Track Booking</Link>
          <Link href="/blog" onClick={close} tabIndex={tab} className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-base font-extrabold hover:bg-white/10"><BookOpen className="size-5 text-amber-300" />Blog</Link>
          <Link href="/contact" onClick={close} tabIndex={tab} className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-base font-extrabold hover:bg-white/10"><MessageSquare className="size-5 text-amber-300" />Contact</Link>
        </div>
      </nav>
    </>
  );
}
