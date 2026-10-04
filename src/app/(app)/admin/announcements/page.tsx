import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { listAnnouncementsForAdmin } from "@/server/actions/announcements";
import { AnnouncementsManager } from "@/components/admin/announcements-manager";

export const metadata = { title: "Announcements — Sahara OS" };

export default async function AnnouncementsAdminPage() {
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const rows = await listAnnouncementsForAdmin();
  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Publish notices to every staff member’s Staff App" />
      <AnnouncementsManager rows={rows} />
    </div>
  );
}
