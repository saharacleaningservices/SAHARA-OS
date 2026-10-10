import { PpcPage, ppcMetadata } from "@/components/public/ppc-landing";
import { PPC_PAGES } from "@/lib/ppc-landing-content";

// Google Ads landing page — see components/public/ppc-landing.tsx.
// Reads company settings / pricing from the DB, which is not available at image build time.
export const dynamic = "force-dynamic";

export const metadata = ppcMetadata(PPC_PAGES["pest-control-services-pune"]);

export default function Page() {
  return <PpcPage slug="pest-control-services-pune" />;
}
