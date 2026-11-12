import Link from "next/link";
import { NAV_MEGA } from "@/config/nav-menu";
import { SidebarMenu } from "@/components/public/sidebar-menu";

/**
 * Public header: official logo left. On lg+ desktop the main links sit inline (Home, Services, Commercial / B2B, Reviews, Contact —
 * owner 2026-11-12); on phones and tablets the hamburger opens the right-hand sidebar with all four categories.
 * No backdrop-filter on the header: it would trap the fixed sidebar inside the 64 px bar. Layout model: BOXED (max-w-6xl), one 64 px row.
 */
export { PRIMARY_CALL, PRIMARY_WHATSAPP } from "@/lib/contact-lines";

export const DESKTOP_NAV = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Commercial / B2B", href: "/services/commercial-services" },
  { label: "Reviews", href: "/#reviews" },
  { label: "Contact", href: "/contact" },
] as const;

export function MegaMenuHeader({ logo }: { logo?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-[55] border-b border-border bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Link href="/" aria-label="Sahara Cleaning Services — home" className="shrink-0">{logo ?? <span className="text-base font-extrabold text-[#0a2540]">Sahara Cleaning</span>}</Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {DESKTOP_NAV.map((n) => (
            <Link key={n.label} href={n.href} className="rounded-full px-4 py-2 text-sm font-bold text-[#0a2540] hover:bg-[#eef4fb] hover:text-primary">{n.label}</Link>
          ))}
        </nav>
        <div className="lg:hidden"><SidebarMenu groups={NAV_MEGA} /></div>
      </div>
    </header>
  );
}
