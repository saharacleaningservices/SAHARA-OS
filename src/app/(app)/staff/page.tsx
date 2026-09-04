import { PageHeader } from "@/components/shared/page-header";
import { StaffExplorer } from "@/components/staff/staff-explorer";
import { NewStaffDialog } from "@/components/staff/new-staff-dialog";
import { StaffImportDialog } from "@/components/staff/staff-import-dialog";
import { getAllStaffForList } from "@/server/staff";
import { requireUser } from "@/lib/current-user";
import { canViewSalary } from "@/lib/permissions";

export default async function StaffPage() {
  const session = await requireUser();
  const staff = await getAllStaffForList();
  const available = staff.filter((s) => s.availability === "AVAILABLE" && s.isActive).length;
  const showSalary = canViewSalary(session.role);

  // Defense in depth: never send wage figures to the client for roles that
  // shouldn't see them, even though the UI also hides the column.
  const rows = showSalary ? staff : staff.map((s) => ({ ...s, dailyWage: null, monthlySalary: null }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description={`${staff.length} team members · ${available} available today`}
        actions={
          showSalary ? (
            <>
              <StaffImportDialog />
              <NewStaffDialog />
            </>
          ) : undefined
        }
      />
      <StaffExplorer staff={rows} canViewSalary={showSalary} />
    </div>
  );
}
