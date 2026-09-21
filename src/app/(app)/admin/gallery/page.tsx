import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { listGalleryItems } from "@/server/actions/gallery";
import { GalleryAdminPanel } from "@/components/gallery/gallery-admin-panel";
import { GALLERY_PUBLIC_URL } from "@/lib/gallery";
import { ExternalLink } from "lucide-react";

export const metadata = { title: "Gallery — Sahara OS" };

export default async function GalleryAdminPage() {
  await requireRole(["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"]);
  const items = await listGalleryItems();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gallery"
        description="Before/after photos and result videos — reused on the booking page, WhatsApp links and review campaigns"
      />
      <a
        href="/gallery"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ExternalLink className="size-3.5" /> Open the public gallery ({GALLERY_PUBLIC_URL})
      </a>
      <GalleryAdminPanel items={items} />
    </div>
  );
}
