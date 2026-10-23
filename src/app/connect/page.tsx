import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Phone, Play, Star, ThumbsUp } from "lucide-react";
import { CompanyLogo } from "@/components/shared/company-logo";
import { getCompanySettings } from "@/server/settings";
import { FIXED_PROFILES } from "@/lib/social-links";
import { CONTACT } from "@/lib/marketing-content";
import { toWhatsAppLink } from "@/lib/utils";

// "Explore Us": one structured links card for customers — before/after videos and photos, social channels, reviews, call / WhatsApp.
// Linked from WhatsApp messages (a template cannot carry a third link button), so it stays out of search results.
export const metadata: Metadata = {
  title: "Explore Sahara Cleaning Services",
  description: "Our work, our channels and how to reach us.",
  robots: { index: false, follow: true },
};

export default async function ConnectPage() {
  const settings = await getCompanySettings();
  const links = [
    { href: FIXED_PROFILES.find((p) => p.key === "youtube")!.url, icon: Play, title: "YouTube", sub: "Watch our cleaning process and result videos" },
    { href: FIXED_PROFILES.find((p) => p.key === "instagram")!.url, icon: Camera, title: "Instagram", sub: "Before & after photos and reels" },
    { href: FIXED_PROFILES.find((p) => p.key === "facebook")!.url, icon: ThumbsUp, title: "Facebook", sub: "Updates, offers and customer stories" },
    ...(settings.googleReviewUrl ? [{ href: settings.googleReviewUrl, icon: Star, title: "Google Reviews", sub: "See what customers say about us" }] : []),
    { href: "/gallery", icon: Camera, title: "Our Work Gallery", sub: "Before & after results on our website" },
  ];
  return (
    <main className="theme-navy mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-[#eef4fb] px-4 py-6 text-[#0a2540]">
      <div className="flex justify-center"><CompanyLogo logoUrl={settings.logoUrl} className="h-12 w-auto" /></div>
      <h1 className="text-center text-xl font-bold">Explore Sahara Cleaning Services</h1>
      <ul className="space-y-2">
        {links.map(({ href, icon: Icon, title, sub }) => (
          <li key={title}>
            <Link href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex min-h-14 items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Icon className="size-5" /></span>
              <span><span className="block text-sm font-bold">{title}</span><span className="block text-xs text-[#0a2540]/70">{sub}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <a href={`tel:+91${CONTACT.call[1]}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground"><Phone className="size-4" /> Call us</a>
        <a href={toWhatsAppLink(CONTACT.whatsapp, "Hi Sahara Cleaning Services")} className="flex min-h-12 items-center justify-center rounded-xl border-2 border-primary px-3 text-sm font-bold text-primary">WhatsApp</a>
      </div>
      <p className="text-center text-xs text-[#0a2540]/60">Helpline 7083347130 / 8956567130 · Serving Pune since 2012</p>
    </main>
  );
}
