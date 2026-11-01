import Link from "next/link";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Faqs, Terms, AreasBadge, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar, ServiceTiles, Panel, BulletList, StickyWhatsApp, type Tile } from "@/components/public/category-landing";
import { CategoryLeadForm } from "@/components/public/category-lead-form";
import { B2bWhatsAppPicker } from "@/components/public/b2b-whatsapp-picker";
import { SeoCtaTracker } from "@/components/public/seo-cta-tracker";
import { IT_PARKS, LOCALITIES, TOWNSHIPS, BRANCHES, ZONES, VERTICALS, type VerticalKey } from "@/config/pune-seo-matrix";
import { branchGraph, magarpattaBranchExtra } from "@/lib/seo-graph";
import { breadcrumbJsonLd } from "@/lib/seo-schema";

export type B2bConfig = {
  path: string;
  vertical: VerticalKey;
  waIntro: string;
  waText: string;
  hero: { title: string; subtitle: string; badge: string; image: string; alt: string; points: string[] };
  tiles: Tile[];
  process: string[];
  panelTitle: string;
  panelItems: string[];
  form: { title: string; serviceLabel: string; typeLabel: string; typeOptions: string[]; cta: string };
  faqs: { q: string; a: string }[];
  linkPages: { label: string; href: string }[];
};

export async function B2bPage({ cfg }: { cfg: B2bConfig }) {
  const settings = await getCompanySettings();
  const v = VERTICALS[cfg.vertical];
  const main = BRANCHES.magarpatta;
  const pickerLocs = LOCALITIES.map((l) => {
    const b = BRANCHES[ZONES[l.zone].branch];
    return { slug: l.slug, name: l.name, pin: l.pins[0], branchLocality: b.locality, whatsapp: b.whatsapp, phone: b.phone };
  });
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={cfg.waText}
      waNumber={main.whatsapp}
      jsonLd={[
        businessJsonLd(magarpattaBranchExtra()),
        ...branchGraph(),
        breadcrumbJsonLd([{ name: "Home", path: "/booking" }, { name: "B2B", path: cfg.path }]),
        faqJsonLd(cfg.faqs),
      ]}
      bookHref="#enquiry"
      mobileBar={<CategoryBar waText={cfg.waText} waNumber={main.whatsapp} cta="Enquire" />}
    >
      <SeoCtaTracker service={`b2b-${cfg.vertical}`} area="Pune" branch="routed" vertical={cfg.vertical} />
      <CategoryHero image={cfg.hero.image} alt={cfg.hero.alt} title={cfg.hero.title} subtitle={cfg.hero.subtitle} points={cfg.hero.points} waText={cfg.waText} waNumber={main.whatsapp} badge={cfg.hero.badge} cta="Request Proposal" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <B2bWhatsAppPicker vertical={cfg.vertical} verticalLabel={v.label} localities={pickerLocs} intro={cfg.waIntro} />
        <ServiceTiles heading="What we handle" tiles={cfg.tiles} />
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="How it works"><BulletList items={cfg.process} /></Panel>
          <Panel title={cfg.panelTitle}><BulletList items={cfg.panelItems} /></Panel>
        </div>
        <CategoryLeadForm
          service={v.crm}
          serviceLabel={cfg.form.serviceLabel}
          campaignName={`B2B desk: ${cfg.vertical}`}
          waNumber={main.whatsapp}
          title={cfg.form.title}
          cta={cfg.form.cta}
          typeLabel={cfg.form.typeLabel}
          typeOptions={cfg.form.typeOptions}
          showCompany
          showDate
          schedule
        />
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Corridors and campuses we are regularly asked to serve</h2>
          <p className="mt-2 text-sm text-[#0a2540]/80">IT parks: {IT_PARKS.map((p) => p.name).join(", ")}. Townships and premium projects: {TOWNSHIPS.map((t) => t.name).join(", ")}.</p>
          <p className="mt-3 flex flex-wrap gap-2 text-sm">
            {cfg.linkPages.map((p) => <Link key={p.href} href={p.href} className="rounded-full bg-[#eef3fb] px-3 py-1 font-medium text-primary">{p.label}</Link>)}
          </p>
        </section>
        <AreasBadge />
        <Faqs faqs={cfg.faqs} compact />
        <Terms />
      </main>
      <StickyWhatsApp waText={cfg.waText} waNumber={main.whatsapp} />
    </LandingShell>
  );
}
