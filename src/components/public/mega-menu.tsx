import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { NAV_MEGA } from "@/config/nav-menu";
import { BRANCHES } from "@/config/pune-seo-matrix";
import { CONTACT, waLink } from "@/lib/marketing-content";
import { SidebarMenu } from "@/components/public/sidebar-menu";

/**
 * Public header (owner 2026-11-02, app-like): official logo left; pulsing "Call Now" and "WhatsApp Us" buttons and the hamburger
 * (right-hand sidebar with all four categories) on the right. No phone numbers are printed in the header — the buttons dial / open
 * WhatsApp directly. No backdrop-filter on the header: it would trap the fixed sidebar inside the 64 px bar. Layout model: BOXED (max-w-6xl), one 64 px row on every screen.
 */
const WA_TEXT = "Hi Sahara, I'd like a quote for a service in Pune.";
export const PRIMARY_CALL = CONTACT.call[0];
export const PRIMARY_WHATSAPP = BRANCHES.magarpatta.whatsapp;

export function MegaMenuHeader({ logo }: { logo?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-[55] border-b border-border bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Link href="/" aria-label="Sahara Cleaning Services — home" className="shrink-0">{logo ?? <span className="text-base font-extrabold text-[#0a2540]">Sahara Cleaning</span>}</Link>
        <div className="flex items-center gap-2">
          <a href={`tel:+91${PRIMARY_CALL}`} aria-label="Call Now" className="sahara-wave-call flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 text-xs font-bold text-white sm:text-sm"><Phone className="size-4" /> Call Now</a>
          <a href={waLink(WA_TEXT, PRIMARY_WHATSAPP)} target="_blank" rel="noreferrer" aria-label="WhatsApp Us" className="sahara-wave-wa flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#25D366] px-3 text-xs font-bold text-white sm:text-sm"><MessageCircle className="size-4" /><span className="hidden min-[400px]:inline">WhatsApp Us</span></a>
          <SidebarMenu groups={NAV_MEGA} />
        </div>
      </div>
    </header>
  );
}
