import { PageHeader } from "@/components/shared/page-header";
import { StaffExplorer } from "@/components/staff/staff-explorer";
import { NewStaffDialog } from "@/components/staff/new-staff-dialog";
import { StaffImportDialog } from "@/components/staff/staff-import-dialog";
import { getAllStaffForList } from "@/server/staff";

export default async function StaffPage() {
  const staff = await getAllStaffForList();
  const available = staff.filter((s) => s.availability === "AVAILABLE" && s.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description={`${staff.length} team members · ${available} available today`}
        actions={
          <>
            <StaffImportDialog />
            <NewStaffDialog />
          </>
        }
      />
      <StaffExplorer staff={staff} />
    </div>
  );
}
