import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { AttendanceList } from "@/components/attendance/attendance-list";
import { AttendanceMonthlySummary } from "@/components/attendance/monthly-summary";
import { MonthlyAttendanceCalendar } from "@/components/attendance/monthly-attendance-calendar";
import { OfficeAttendanceClock } from "@/components/attendance/office-attendance-clock";
import { MyAttendanceCard } from "@/components/attendance/my-attendance-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollText } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { canManageAttendance, canViewSalary } from "@/lib/permissions";
import { listTodayAttendanceAll, getMonthlyLedgerForAllStaff, getMonthMatrix, getMyStaffLedger } from "@/server/attendance";
import { db } from "@/lib/db";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; staff?: string }>;
}) {
  const session = await requireUser();
  const { year: yStr, month: mStr, staff: staffParam } = await searchParams;
  const now = new Date();
  const year = Number(yStr) || now.getFullYear();
  const month = Number(mStr) || now.getMonth() + 1;

  const canManage = canManageAttendance(session.role); // ADMIN | ACCOUNTS — payroll-editing capability
  const canReopen = session.role === "ADMIN";
  // Francis (OPERATIONS) and Field Coordinators (SUPERVISOR) get the team
  // attendance view for operational visibility, not the correction/edit
  // capability — canManage (passed to AttendanceList below) stays
  // ADMIN/ACCOUNTS-only regardless of this flag.
  const canViewTeamAttendance = session.role === "SUPERVISOR" || session.role === "OPERATIONS";

  const staffList = await db.staff.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, employeeCode: true, designation: true },
  });

  const selectedId = staffParam && staffList.some((s) => s.id === staffParam) ? staffParam : staffList[0]?.id;

  const [all, monthly, matrix, myLedger] = await Promise.all([
    listTodayAttendanceAll(),
    canManage ? getMonthlyLedgerForAllStaff(year, month) : Promise.resolve([]),
    canManage && selectedId ? getMonthMatrix(selectedId, year, month) : Promise.resolve(null),
    getMyStaffLedger(session.sub, year, month),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Monthly attendance calendar, office check-in/out and payroll"
        actions={
          canManage ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/attendance/audit"><ScrollText className="size-3.5" /> Audit Log</Link>
            </Button>
          ) : null
        }
      />

      {/* Office clock — Altaf / Shoaib / Francis */}
      <OfficeAttendanceClock rows={all} staff={staffList} />

      {/* "My Attendance & Salary" shows the logged-in user's own earned
          wage/balance — Francis (SUPERVISOR) must not see any salary/wage/
          payroll figure at all per his 2026-09-22 policy, even his own.
          Left unchanged for every other role (a plain Staff worker's own
          pay view is a legitimate, unrelated existing feature). */}
      {myLedger && session.role !== "SUPERVISOR" && <MyAttendanceCard ledger={myLedger} />}

      {(canManage || canViewTeamAttendance) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Today — All Staff</h2>
          <AttendanceList rows={all} canManage={canManage} />
        </div>
      )}

      {canManage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly Calendar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {staffList.map((s) => (
                <Link
                  key={s.id}
                  href={`/attendance?staff=${s.id}&year=${year}&month=${month}`}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    s.id === selectedId ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {s.name}
                </Link>
              ))}
            </div>
            {matrix && selectedId ? (
              <MonthlyAttendanceCalendar
                staffId={selectedId}
                year={matrix.year}
                month={matrix.month}
                days={matrix.days}
                totals={matrix.totals}
                closed={matrix.closed}
                canEdit={canManage}
                canReopen={canReopen}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Add a staff member to start marking attendance.</p>
            )}
          </CardContent>
        </Card>
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
