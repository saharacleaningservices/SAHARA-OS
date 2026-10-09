import { getPublicPricing } from "@/server/pricing";
import descriptions from "@/lib/catalog-descriptions.json";

// WhatsApp / Meta catalogue data feed generated from the Sahara pricing
// master, so the catalogue always shows the same prices as the landing
// pages, booking page, CRM price list and quotations. Add this URL in
// Commerce Manager → Catalogue → Data sources → Data feed → "Use a URL"
// with a daily schedule:
//   https://booking.saharacleaningservices.com/marketing/catalog-feed
// Only priced items are included (Commerce Manager requires a price);
// inspection-based services stay off the catalogue.

export const dynamic = "force-dynamic";

const BASE = "https://booking.saharacleaningservices.com";
const UTM = "?utm_source=whatsapp&utm_medium=catalog&utm_campaign=sahara_catalog";
const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

export async function GET() {
  const { items } = await getPublicPricing();
  const byId = descriptions as Record<string, { description: string; image: string }>;
  const rows = items.filter((p) => p.price != null && byId[p.contentId]).map((p) => {
    const d = byId[p.contentId];
    const price = p.mrp ?? p.price!;
    const sale = p.mrp ? `${p.price} INR` : "";
    return [p.contentId, p.name, d.description, "in stock", "new", `${price} INR`, sale, `${BASE}/booking${UTM}`, `${BASE}/marketing/catalog/${d.image}`, "Sahara Cleaning Services"]
      .map((v) => esc(String(v)))
      .join(",");
  });
  const csv = ["id,title,description,availability,condition,price,sale_price,link,image_link,brand", ...rows].join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
