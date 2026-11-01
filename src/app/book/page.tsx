import { redirect } from "next/navigation";

// /book (the standalone booking form) was retired on 2026-10-31: /booking (BookingWizard) is the single booking flow.
// This route stays only so old ads, QR codes, SMS/WhatsApp links and staff-sent ?bl= links keep working. All params
// (UTMs, ref, prefill, bl) are carried over; the legacy ?category= is mapped to the wizard's ?service=.

export const dynamic = "force-dynamic";

const CATEGORY_TO_SERVICE: Record<string, string> = { HOME_DEEP_CLEANING: "home", COMMERCIAL_CLEANING: "commercial", PEST_CONTROL: "pest", PAINTING: "painting" };

export default async function LegacyBookRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v && k !== "category") q.set(k, v);
  }
  const service = CATEGORY_TO_SERVICE[typeof sp.category === "string" ? sp.category : ""];
  if (service) q.set("service", service);
  redirect(`/booking${q.size ? `?${q.toString()}` : ""}`);
}
