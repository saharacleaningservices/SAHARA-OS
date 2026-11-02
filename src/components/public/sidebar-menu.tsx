"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import type { NavMega } from "@/config/nav-menu";

/**
 * Right-hand sidebar menu (owner 2026-11-02: logo left, hamburger right on every screen size). Lists all four categories —
 * Residential, Individual, Commercial (B2B), Relocation & Property — as collapsible groups, plus Our Work / Contact.
 * Body scroll is locked while open; Escape or the backdrop closes it. Rendered closed on the server (no layout shift).
 */
export function SidebarMenu({ groups }: { groups: NavMega[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>("residential");
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <>
      <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="flex size-11 items-center justify-center rounded-xl border border-border text-[#0a2540] hover:bg-[#eef4fb]">
        <Menu className="size-6" />
      </button>
      <div className={`fixed inset-0 z-[60] bg-[#0a2540]/50 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => setOpen(false)} aria-hidden />
      <nav aria-label="Main" aria-hidden={!open} className={`fixed inset-y-0 right-0 z-[61] flex w-[86%] max-w-sm flex-col bg-white shadow-2xl transition-[transform,visibility] duration-300 ease-out ${open ? "visible translate-x-0" : "invisible translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-base font-extrabold text-[#0a2540]">Menu</p>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="flex size-10 items-center justify-center rounded-full bg-[#eef4fb]"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <Link href="/" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="block rounded-xl px-3 py-3 text-sm font-bold text-[#0a2540] hover:bg-[#eef4fb]">Home</Link>
          {groups.map((g) => {
            const isOpen = expanded === g.id;
            return (
              <section key={g.id} className="border-t border-border/70">
                <button type="button" aria-expanded={isOpen} tabIndex={open ? 0 : -1} onClick={() => setExpanded(isOpen ? null : g.id)} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-extrabold text-[#0a2540] hover:bg-[#eef4fb]">
                  {g.label}<ChevronDown className={`size-4 transition ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <ul className="pb-2 pl-2">
                    {g.items.map((i) => (
                      <li key={i.href}><Link href={i.href} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="block rounded-lg px-3 py-2 text-sm text-[#0a2540]/85 hover:bg-[#eef4fb] hover:text-primary">{i.label}</Link></li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          <div className="border-t border-border/70 pt-1">
            {[["/gallery", "Our Work"], ["/pune", "Areas We Serve"], ["/contact", "Contact"]].map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="block rounded-xl px-3 py-3 text-sm font-bold text-[#0a2540] hover:bg-[#eef4fb]">{label}</Link>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
