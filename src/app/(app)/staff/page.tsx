import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StaffExplorer } from "@/components/staff/staff-explorer";
import { NewStaffDialog } from "@/components/staff/new-staff-dialog";
import { StaffImportDialog } from "@/components/staff/staff-import-dialog";
import { Button } from "@/components/ui/button";
import { getAllStaffForList } from "@/server/staff";
import { requireUser } from "@/lib/current-user";
import { canViewSalary } from "@/lib/permissions";
import { BarChart3 } from "lucide-react";
import { listOpenStaffPinResets } from "@/server/staff-pin-reset";
import { PinResetRequests } from "@/components/staff/pin-reset-requests";

export default async function StaffPage() {
  const session = await requireUser();
  const staff = await getAllStaffForList();
  const available = staff.filter((s) => s.availability === "AVAILABLE" && s.isActive).length;
  const showSalary = canViewSalary(session.role);

  // Defense in depth: never send wage figures to the client for roles that
  // shouldn't see them, even though the UI also hides the column.
  // Also no bank / UPI details, documents, day wage, or the assigned job's customer
  // contact and amounts (owner rule 2026-10-08) — the list needs job number + status only.
  const rows = showSalary
    ? staff
    : staff.map((s) => ({
        ...s,
        dailyWage: null,
        monthlySalary: null,
        bankAccount: null,
        bankIfsc: null,
        bankName: null,
        bankAccountName: null,
        upiId: null,
        gpayNumber: null,
        documents: null,
        attendance: s.attendance.map((a) => ({ ...a, wageForDay: null })),
        jobAssignments: s.jobAssignments.map((ja) => ({ ...ja, job: { jobNumber: ja.job.jobNumber } })),
      }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description={`${staff.length} team members · ${available} available today`}
        actions={
          showSalary ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/staff/performance">
                  <BarChart3 className="mr-1.5 size-4" /> Performance Report
                </Link>
              </Button>
              <StaffImportDialog />
              <NewStaffDialog />
            </>
          ) : undefined
        }
      />
      {showSalary && <PinResetRequests rows={await listOpenStaffPinResets()} />}
      <StaffExplorer staff={rows} canViewSalary={showSalary} />
    </div>
  );
}
