import { PageHeader } from "@/components/shared/page-header";
import { SelfAttendanceCard } from "@/components/attendance/self-attendance-card";
import { AttendanceList } from "@/components/attendance/attendance-list";
import { AttendanceMonthlySummary } from "@/components/attendance/monthly-summary";
import { requireUser } from "@/lib/current-user";
import { canManageAttendance, canViewSalary } from "@/lib/permissions";
import { getTodayAttendance, listTodayAttendanceAll, getMonthlyLedgerForAllStaff } from "@/server/attendance";
import { db } from "@/lib/db";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const session = await requireUser();
  const { year: yStr, month: mStr } = await searchParams;
  const now = new Date();
  const year = Number(yStr) || now.getFullYear();
  const month = Number(mStr) || now.getMonth() + 1;

  const staffProfile = await db.staff.findUnique({ where: { userId: session.sub }, select: { id: true } });

  const canManage = canManageAttendance(session.role);
  const showAll = canManage || session.role === "SUPERVISOR";

  const [own, all, monthly] = await Promise.all([
    staffProfile ? getTodayAttendance(staffProfile.id) : null,
    listTodayAttendanceAll(),
    canManage ? getMonthlyLedgerForAllStaff(year, month) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Check in/out and daily attendance for the team" />

      {staffProfile && (
        <SelfAttendanceCard
          checkInTime={own?.checkInTime ?? null}
          checkOutTime={own?.checkOutTime ?? null}
          method={own?.method ?? null}
        />
      )}

      {showAll && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Today — All Staff</h2>
          <AttendanceList rows={all} canManage={canManage} />
        </div>
      )}

      {canManage && (
        <AttendanceMonthlySummary
          rows={monthly}
          year={year}
          month={month}
          canViewSalary={canViewSalary(session.role)}
        />
      )}
    </div>
  );
}
