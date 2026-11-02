import Link from "next/link";
import { NAV_MEGA } from "@/config/nav-menu";
import { SidebarMenu } from "@/components/public/sidebar-menu";

/**
 * Public header (owner 2026-11-03): official logo left and the hamburger (right-hand sidebar with all four categories) on the right.
 * The Call Now / WhatsApp Us buttons are gone from the bar — contact now lives in the single floating button (floating-contact.tsx).
 * No backdrop-filter on the header: it would trap the fixed sidebar inside the 64 px bar. Layout model: BOXED (max-w-6xl), one 64 px row.
 */
export { PRIMARY_CALL, PRIMARY_WHATSAPP } from "@/lib/contact-lines";

export function MegaMenuHeader({ logo }: { logo?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-[55] border-b border-border bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Link href="/" aria-label="Sahara Cleaning Services — home" className="shrink-0">{logo ?? <span className="text-base font-extrabold text-[#0a2540]">Sahara Cleaning</span>}</Link>
        <SidebarMenu groups={NAV_MEGA} />
      </div>
    </header>
  );
}
