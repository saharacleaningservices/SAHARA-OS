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
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";
import { requireUser } from "@/lib/current-user";
import { canViewSalary, canManageStaffFinancials } from "@/lib/permissions";
import { getStaffLedger } from "@/server/attendance";

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const showSalary = canViewSalary(session.role);
  const ledger = showSalary ? await getStaffLedger(staff.id, now.getFullYear(), now.getMonth() + 1) : null;
  const payslipHref = `/api/staff/${staff.id}/payslip/pdf?year=${now.getFullYear()}&month=${now.getMonth() + 1}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={staff.name}
        description={`${staff.employeeCode} · ${staff.designation}`}
        actions={
          <>
            <CallButton mobile={staff.mobile} />
            <WhatsAppButton mobile={staff.mobile} />
            {showSalary && (
              <Button variant="outline" asChild>
                <a href={payslipHref} target="_blank" rel="noreferrer">
                  <FileDown className="size-3.5" /> Salary Slip
                </a>
              </Button>
            )}
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
              {(staff.bankAccount || staff.gpayNumber) && (
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

          <Card>
            <CardHeader>
              <CardTitle>Recent Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {staff.jobAssignments.length === 0 ? (
                <EmptyState title="No jobs assigned yet" />
              ) : (
                <div className="space-y-2">
                  {staff.jobAssignments.map((a) => (
                    <Link
                      key={a.id}
                      href={`/jobs/${a.job.id}`}
                      className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/40"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{a.job.jobNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {SERVICE_LABELS[a.job.service]} · {formatDate(a.job.scheduledDate)}
                        </p>
                      </div>
                      <JobStatusBadge status={a.job.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <StaffDocumentsCard
            staffId={staff.id}
            documents={documents}
            canEdit={session.role === "ADMIN" || session.role === "OPERATIONS"}
          />
          {ledger && (
            <PayrollLedgerCard
              staffId={staff.id}
              monthLabel={now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              presentDays={ledger.presentDays}
              earned={ledger.earned}
              advanceTotal={ledger.advanceTotal}
              fineTotal={ledger.fineTotal}
              rewardTotal={ledger.rewardTotal}
              netBalance={ledger.netBalance}
              canManage={canManageStaffFinancials(session.role)}
            />
          )}
          <Card>
            <CardHeader>
              <CardTitle>Attendance (last 30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {staff.attendance.length === 0 ? (
                <EmptyState title="No attendance marked yet" />
              ) : (
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
