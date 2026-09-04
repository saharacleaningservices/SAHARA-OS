import { PageHeader } from "@/components/shared/page-header";
import { SelfAttendanceCard } from "@/components/attendance/self-attendance-card";
import { AttendanceList } from "@/components/attendance/attendance-list";
import { requireUser } from "@/lib/current-user";
import { canManageAttendance } from "@/lib/permissions";
import { getTodayAttendance, listTodayAttendanceAll } from "@/server/attendance";
import { db } from "@/lib/db";

export default async function AttendancePage() {
  const session = await requireUser();
  const staffProfile = await db.staff.findUnique({ where: { userId: session.sub }, select: { id: true } });

  const [own, all] = await Promise.all([
    staffProfile ? getTodayAttendance(staffProfile.id) : null,
    listTodayAttendanceAll(),
  ]);

  const canManage = canManageAttendance(session.role);
  const showAll = canManage || session.role === "SUPERVISOR";

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
    </div>
  );
}
