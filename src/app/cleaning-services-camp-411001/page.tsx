import { PincodeLanding, pincodeMetadata } from "@/components/public/pincode-landing";

// Pune pincode landing page (src/lib/pincode-pages.ts). Reads company settings, so it renders per request.
export const dynamic = "force-dynamic";

const SLUG = "cleaning-services-camp-411001";
export const generateMetadata = () => pincodeMetadata(SLUG);
export default function Page() {
  return <PincodeLanding slug={SLUG} />;
}
