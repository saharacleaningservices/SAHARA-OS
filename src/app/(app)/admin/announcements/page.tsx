import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { listAnnouncementsForAdmin, listStaffForAnnouncements } from "@/server/actions/announcements";
import { AnnouncementsManager } from "@/components/admin/announcements-manager";

export const metadata = { title: "Announcements — Sahara OS" };

export default async function AnnouncementsAdminPage() {
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const [rows, staff] = await Promise.all([listAnnouncementsForAdmin(), listStaffForAnnouncements()]);
  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Office messages to the Staff App — all staff, selected staff or a team" />
      <AnnouncementsManager rows={rows} staff={staff} />
    </div>
  );
}
