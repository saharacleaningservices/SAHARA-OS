import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";

type Ledger = {
  staff: { name: string; employeeCode: string; designation: string };
  year: number;
  month: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  weeklyOffDays: number;
  overtimeHours: number;
  payableDays: number;
  earned: number;
  advanceTotal: number;
  balance: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "green" | "red" | "amber" }) {
  const color =
    tone === "green" ? "text-success" : tone === "red" ? "text-destructive" : tone === "amber" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export function MyAttendanceCard({ ledger }: { ledger: Ledger }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          My Attendance &amp; Salary — {MONTHS[ledger.month - 1]} {ledger.year}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {ledger.staff.name} · {ledger.staff.employeeCode} · {ledger.staff.designation} · live calculation
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Present Days" value={ledger.presentDays} tone="green" />
          <Stat label="Half Days" value={ledger.halfDays} tone="amber" />
          <Stat label="Absent Days" value={ledger.absentDays} tone="red" />
          <Stat label="Overtime (hrs)" value={ledger.overtimeHours} />
          <Stat label="Weekly Off" value={ledger.weeklyOffDays} />
          <Stat label="Leave" value={ledger.leaveDays} />
          <Stat label="Payable Days" value={ledger.payableDays} />
          <Stat label="Advance Taken" value={formatINR(ledger.advanceTotal)} tone={ledger.advanceTotal > 0 ? "red" : undefined} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Salary Earned" value={formatINR(ledger.earned)} tone="green" />
          <Stat label="Current Balance" value={formatINR(ledger.balance)} tone={ledger.balance >= 0 ? "green" : "red"} />
        </div>
        <p className="text-xs text-muted-foreground">
          Balance = Salary Earned + Rewards − Advance − Fines. For any correction, contact the office.
        </p>
      </CardContent>
    </Card>
  );
}
