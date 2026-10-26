import Link from "next/link";

/** Link tabs that join related pages under one sidebar entry (owner 2026-10-23: fewer duplicate menu items, still one click). */
export function SectionTabs({ tabs, active }: { tabs: { label: string; href: string }[]; active: string }) {
  return (
    <nav aria-label="Related pages" className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${t.href === active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export const PRICE_TABS = [
  { label: "Price List", href: "/leads/price-list" },
  { label: "Service Catalog", href: "/service-catalog" },
];

export const WHATSAPP_TABS = [
  { label: "Message Log", href: "/admin/whatsapp-log" },
  { label: "WhatsApp Inbox", href: "/admin/whatsapp-inbox" },
];
