import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { getStaffDetail } from "@/server/staff";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { AvailabilityBadge, AttendanceBadge, JobStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { FileDown } from "lucide-react";
import { NewStaffDialog } from "@/components/staff/new-staff-dialog";
import { PayrollLedgerCard } from "@/components/staff/payroll-ledger-card";
import { StaffDocumentsCard } from "@/components/staff/staff-documents-card";
import { MonthlyAttendanceCalendar } from "@/components/attendance/monthly-attendance-calendar";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";
import { requireUser } from "@/lib/current-user";
import { StaffPhotoUploader } from "@/components/staff/staff-photo-uploader";
import { canViewSalary, canManageStaffFinancials, canManageAttendance } from "@/lib/permissions";
import { getStaffLedger, getMonthMatrix } from "@/server/attendance";
import { StaffAppAccessCard } from "@/components/staff/staff-app-access-card";
import { getStaffAppAccess } from "@/server/actions/staff-app-access";
import { startStaffPreview } from "@/server/actions/staff-preview";
import { Smartphone } from "lucide-react";

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { id } = await params;
  const { year: yStr, month: mStr } = await searchParams;
  const session = await requireUser();
  const staff = await getStaffDetail(id);
  if (!staff) notFound();

  const presentDays = staff.attendance.filter((a) => a.status === "PRESENT" || a.status === "HALF_DAY").length;
  const absentDays = staff.attendance.filter((a) => a.status === "ABSENT").length;
  const totalWages = staff.attendance.reduce((sum, a) => sum + (a.wageForDay ?? 0), 0);
  const documents: { label: string; url: string; uploadedAt: string }[] = staff.documents
    ? JSON.parse(staff.documents)
    : [];

  const now = new Date();
  const calYear = Number(yStr) || now.getFullYear();
  const calMonth = Number(mStr) || now.getMonth() + 1;
  const showSalary = canViewSalary(session.role);
  const canAttendance = canManageAttendance(session.role);
  const [ledger, matrix, appAccess] = await Promise.all([
    showSalary ? getStaffLedger(staff.id, calYear, calMonth) : Promise.resolve(null),
    canAttendance ? getMonthMatrix(staff.id, calYear, calMonth) : Promise.resolve(null),
    showSalary ? getStaffAppAccess(staff.id) : Promise.resolve(null),
  ]);
  const payslipHref = `/api/staff/${staff.id}/payslip/pdf?year=${calYear}&month=${calMonth}`;

  return (
    <div className="space-y-6">
      <StaffPhotoUploader
        staffId={staff.id}
        name={staff.name}
        photoUrl={staff.photoUrl}
        canEdit={["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(session.role)}
        size={72}
      />
      <PageHeader
        title={staff.name}
        description={`${staff.employeeCode} · ${staff.designation}`}
        actions={
          <>
            {session.role === "ADMIN" && (
              <form action={startStaffPreview.bind(null, staff.id)}>
                <Button variant="outline" type="submit">
                  <Smartphone className="size-3.5" /> Preview Staff App
                </Button>
              </form>
            )}
            <CallButton mobile={staff.mobile} />
            <WhatsAppButton mobile={staff.mobile} />
            {showSalary && (
              <Button variant="outline" asChild>
                <a href={payslipHref} target="_blank" rel="noreferrer">
                  <FileDown className="size-3.5" /> Salary Slip
                </a>
              </Button>
            )}
            {/* Real gap found in the 2026-09-21 Francis policy audit: this
                Edit dialog was rendered unconditionally, carrying
                dailyWage/monthlySalary/bankAccount/bankIfsc/gpayNumber as
                defaultValues regardless of role — present in the page's
                props/hydration data even though the passive display fields
                elsewhere on this page were already correctly gated by
                showSalary. The Staff LIST page (staff/page.tsx) already
                gates its own Add/Edit capability behind showSalary — this
                brings the detail page in line with that same, already-
                settled pattern (not a new restriction: OPERATIONS never
                had this on the list page either). */}
            {showSalary && (
              <NewStaffDialog
                staffId={staff.id}
                defaultValues={{
                  name: staff.name,
                  mobile: staff.mobile,
                  alternateMobile: staff.alternateMobile ?? "",
                  designation: staff.designation,
                  salaryType: staff.salaryType as "DAILY" | "MONTHLY",
                  dailyWage: staff.dailyWage ?? undefined,
                  monthlySalary: staff.monthlySalary ?? undefined,
                  joiningDate: (staff.joiningDate ?? staff.joinDate)
                    ? new Date(staff.joiningDate ?? staff.joinDate).toISOString().slice(0, 10)
                    : "",
                  reference: staff.reference ?? "",
                  bankAccount: staff.bankAccount ?? "",
                  bankIfsc: staff.bankIfsc ?? "",
                  gpayNumber: staff.gpayNumber ?? "",
                  notes: staff.notes ?? "",
                }}
                trigger={
                  <Button variant="outline">
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Mobile</p>
                <p className="font-medium text-foreground">{staff.mobile}</p>
              </div>
              {staff.alternateMobile && (
                <div>
                  <p className="text-xs text-muted-foreground">Alternate Mobile</p>
                  <p className="font-medium text-foreground">{staff.alternateMobile}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Availability</p>
                <AvailabilityBadge status={staff.availability} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Joining Date</p>
                <p className="font-medium text-foreground">{formatDate(staff.joiningDate ?? staff.joinDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reference</p>
                <p className="font-medium text-foreground">{staff.reference ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Wage Type</p>
                <p className="font-medium text-foreground">
                  {staff.salaryType === "DAILY" ? "Daily Wage" : "Monthly Salary"}
                </p>
              </div>
              {showSalary && (
                <div>
                  <p className="text-xs text-muted-foreground">Salary</p>
                  <p className="font-medium text-foreground">
                    {staff.salaryType === "DAILY" ? `${formatINR(staff.dailyWage)}/day` : `${formatINR(staff.monthlySalary)}/month`}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Present (last 30d)</p>
                <p className="font-medium text-foreground">{presentDays} days</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Absent (last 30d)</p>
                <p className="font-medium text-foreground">{absentDays} days</p>
              </div>
              {showSalary && (
                <div>
                  <p className="text-xs text-muted-foreground">Wages Paid (last 30d)</p>
                  <p className="font-medium text-foreground">{formatINR(totalWages)}</p>
                </div>
              )}
              {/* Bank/GPay account details are financial-sensitive, same
                  category as salary/wage — previously shown to ANY role with
                  staff-detail access (a real gap found in the 2026-09-21
                  Francis policy audit: OPERATIONS's own settled policy
                  already excludes "staff salary/wage figures", and bank
                  account data is squarely in that category, so this fix
                  corrects an existing leak, not a new restriction). */}
              {showSalary && (staff.bankAccount || staff.gpayNumber) && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Payment Details</p>
                  <p className="font-medium text-foreground">
                    {staff.bankAccount ? `A/C ${staff.bankAccount}${staff.bankIfsc ? ` · ${staff.bankIfsc}` : ""}` : ""}
                    {staff.bankAccount && staff.gpayNumber ? " · " : ""}
                    {staff.gpayNumber ? `GPay ${staff.gpayNumber}` : ""}
                  </p>
                </div>
              )}
              {staff.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="font-medium text-foreground">{staff.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {(() => {
            const now = new Date();
            const s0 = new Date(now); s0.setHours(0, 0, 0, 0);
            const s1 = new Date(s0); s1.setDate(s1.getDate() + 1);
            const jobs = staff.jobAssignments.map((a) => a.job);
            // Operations/Supervisor: customer & job detail only for today + tomorrow; other days show date + status.
            const s2 = new Date(s1); s2.setDate(s2.getDate() + 1);
            const fieldRole = session.role === "OPERATIONS" || session.role === "SUPERVISOR";
            const detailOk = (d: Date) => !fieldRole || (d >= s0 && d < s2);
            const today = jobs.filter((j) => j.scheduledDate >= s0 && j.scheduledDate < s1 && j.status !== "COMPLETED" && j.status !== "CANCELLED");
            const upcoming = jobs.filter((j) => j.scheduledDate >= s1 && j.status !== "COMPLETED" && j.status !== "CANCELLED");
            const completed = jobs.filter((j) => j.status === "COMPLETED");
            const Section = ({ title, list }: { title: string; list: typeof jobs }) => (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {title} ({list.length})
                </p>
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground">None</p>
                ) : (
                  <div className="space-y-1.5">
                    {list.slice(0, 6).map((j) => !detailOk(j.scheduledDate) ? (
                      <div key={j.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                        <p className="text-xs text-muted-foreground">Job · {formatDate(j.scheduledDate)}</p>
                        <JobStatusBadge status={j.status} />
                      </div>
                    ) : (
                      <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between rounded-lg border border-border p-2.5 hover:bg-muted/40">
                        <div>
                          <p className="text-sm font-medium text-foreground">{j.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {j.jobNumber} · {SERVICE_LABELS[j.service] ?? j.service} · {formatDate(j.scheduledDate)}
                          </p>
                        </div>
                        <JobStatusBadge status={j.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Job History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {jobs.length === 0 ? (
                    <EmptyState title="No jobs assigned yet" />
                  ) : (
                    <>
                      <Section title="Today" list={today} />
                      <Section title="Upcoming" list={upcoming} />
                      <Section title="Completed" list={completed} />
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </div>

        <div className="space-y-4">
          {/* Owner instruction 2026-09-21 (Francis final policy): "HIDE
              COMPLETELY: Private staff documents" for SUPERVISOR/Francis —
              was previously shown to any role with staff-detail access. */}
          {session.role !== "SUPERVISOR" && (
            <StaffDocumentsCard
              staffId={staff.id}
              documents={documents}
              canEdit={session.role === "ADMIN" || session.role === "ACCOUNTS"}
            />
          )}
          {ledger && (
            <PayrollLedgerCard
              staffId={staff.id}
              monthLabel={new Date(calYear, calMonth - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              presentDays={ledger.presentDays}
              earned={ledger.earned}
              advanceTotal={ledger.advanceTotal}
              fineTotal={ledger.fineTotal}
              rewardTotal={ledger.rewardTotal}
              netBalance={ledger.netBalance}
              canManage={canManageStaffFinancials(session.role)}
            />
          )}
          {appAccess && (
            <StaffAppAccessCard
              staffId={staff.id}
              access={appAccess}
              canManage={session.role === "ADMIN"}
              canApproveReset={session.role === "ADMIN" || session.role === "ACCOUNTS"}
            />
          )}
          {!canAttendance && staff.attendance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Attendance (last 30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Wage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staff.attendance.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">{formatDate(a.date)}</TableCell>
                          <TableCell>
                            <AttendanceBadge status={a.status} />
                          </TableCell>
                          <TableCell className="text-right text-sm">{formatINR(a.wageForDay)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {matrix && (
        <MonthlyAttendanceCalendar
          staffId={staff.id}
          year={matrix.year}
          month={matrix.month}
          days={matrix.days}
          totals={matrix.totals}
          closed={matrix.closed}
          canEdit={canAttendance}
          canReopen={session.role === "ADMIN"}
        />
      )}
    </div>
  );
}
