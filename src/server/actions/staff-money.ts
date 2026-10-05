"use server";

// Khata-style employee money (Super Admin + Accounts only).
// - One payment entry screen: type + mode + reference/UPI + note.
// - Records are never edited or hard-deleted: corrections are REVERSAL
//   entries that point at the original (reason required).
// - Every write is audit-logged and the staff member gets a Staff-App alert.
// - Balance is always computed from transactions (server/staff-balance.ts).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canManageStaffFinancials } from "@/lib/permissions";
import { notifyStaff } from "@/server/staff-notify";

const MODES = ["CASH", "UPI", "GOOGLE_PAY", "BANK_TRANSFER", "OTHER"] as const;
// LOAN / LOAN_RECOVERY go to the separate loan ledger; the rest to the salary ledger.
const TYPES = ["SALARY", "ADVANCE", "LOAN", "LOAN_RECOVERY", "EXPENSE", "ADJUSTMENT", "BONUS", "OTHER"] as const;
type PayType = (typeof TYPES)[number];

const LABEL: Record<PayType, string> = {
  SALARY: "Salary paid",
  ADVANCE: "Advance",
  LOAN: "Loan given",
  LOAN_RECOVERY: "Loan recovery",
  EXPENSE: "Expense (owed to worker)",
  ADJUSTMENT: "Adjustment",
  BONUS: "Bonus",
  OTHER: "Other",
};

const schema = z.object({
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive().max(10_000_000),
  type: z.enum(TYPES),
  mode: z.enum(MODES).optional(),
  reference: z.string().trim().max(120).optional(),
  upiId: z.string().trim().max(120).optional(),
  note: z.string().trim().max(300).optional(),
  // ADJUSTMENT / OTHER: direction from the worker's side.
  direction: z.enum(["OWED_TO_WORKER", "PAID_TO_WORKER"]).optional(),
  // LOAN_RECOVERY: cut from salary (also reduces Salary Due) or paid back separately.
  fromSalary: z.boolean().optional(),
});

async function guard() {
  const session = await getSession();
  return session && canManageStaffFinancials(session.role) ? session : null;
}

function refresh(staffId: string) {
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/my");
  revalidatePath("/my/records");
}

/** Record a payment / transaction for one employee. */
export async function recordStaffTransaction(values: unknown) {
  const session = await guard();
  if (!session) return { error: "Not authorized" };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid entry" };
  const v = parsed.data;
  const staff = await db.staff.findFirst({ where: { id: v.staffId, deletedAt: null }, select: { id: true, name: true, employeeCode: true } });
  if (!staff) return { error: "Employee not found" };
  if ((v.type === "ADJUSTMENT" || v.type === "OTHER") && (!v.direction || !v.note)) return { error: "Adjustment needs a direction and a reason" };
  const when = new Date(`${v.date}T12:00:00+05:30`);
  const text = [LABEL[v.type], v.note].filter(Boolean).join(" · ");
  const isLoan = v.type === "LOAN" || v.type === "LOAN_RECOVERY";
  let createdId: string;

  if (isLoan) {
    if (v.type === "LOAN_RECOVERY") {
      const out = await db.staffLoanEntry.aggregate({ where: { staffId: staff.id, deletedAt: null }, _sum: { signedAmount: true } });
      if (v.amount > (out._sum.signedAmount ?? 0) + 0.001) return { error: "Recovery is more than the loan remaining." };
    }
    const row = await db.staffLoanEntry.create({
      data: {
        staffId: staff.id,
        date: when,
        kind: v.type === "LOAN" ? "LOAN_GIVEN" : "LOAN_REPAID",
        amount: v.amount,
        signedAmount: v.type === "LOAN" ? v.amount : -v.amount,
        fromSalary: v.type === "LOAN_RECOVERY" ? v.fromSalary !== false : false,
        description: [text, v.mode, v.reference ? `Ref ${v.reference}` : null].filter(Boolean).join(" · "),
        source: "MANUAL",
        createdByName: session.name,
      },
    });
    createdId = row.id;
  } else {
    // + = owed to the worker (credit), − = paid to the worker (debit)
    const owed =
      v.type === "EXPENSE" || v.type === "BONUS" || ((v.type === "ADJUSTMENT" || v.type === "OTHER") && v.direction === "OWED_TO_WORKER");
    const row = await db.staffLedgerEntry.create({
      data: {
        staffId: staff.id,
        date: when,
        kind: v.type === "SALARY" ? "SALARY_PAID" : v.type,
        amount: v.amount,
        signedAmount: owed ? v.amount : -v.amount,
        description: text,
        paymentMode: v.mode ?? null,
        reference: v.reference || null,
        upiId: v.upiId || null,
        reason: v.type === "ADJUSTMENT" || v.type === "OTHER" ? (v.note ?? null) : null,
        source: "MANUAL",
        createdByName: session.name,
      },
    });
    createdId = row.id;
  }

  await db.auditLog.create({
    data: {
      entityType: "Staff",
      entityId: staff.id,
      action: `MONEY_${v.type}`,
      summary: `${staff.employeeCode ?? ""} ${staff.name}: ${LABEL[v.type]} ₹${v.amount}${v.mode ? ` via ${v.mode}` : ""}${v.reference ? ` ref ${v.reference}` : ""}`.trim(),
      actorName: session.name,
      actorEmail: session.email,
      meta: JSON.stringify({ ...v, recordId: createdId }),
    },
  });
  await notifyStaff([staff.id], {
    kind: isLoan ? "STAFF_LOAN" : "STAFF_PAYMENT",
    title: `${LABEL[v.type]} ₹${v.amount.toLocaleString("en-IN")}`,
    body: v.note || undefined,
    href: "/my/records",
    recordId: createdId,
  });
  refresh(staff.id);
  return { ok: true as const, id: createdId };
}

/** Correct a manual salary-ledger entry by adding its exact opposite (the original stays). */
export async function reverseStaffTransaction(entryId: string, reason: string) {
  const session = await guard();
  if (!session) return { error: "Not authorized" };
  if (!reason?.trim()) return { error: "Reason is required" };
  const e = await db.staffLedgerEntry.findUnique({ where: { id: entryId } });
  if (!e || e.deletedAt) return { error: "Entry not found" };
  if (e.source === "KHATABOOK") return { error: "Imported Khata Book entries are corrected by rolling back the import batch." };
  if (e.kind === "REVERSAL") return { error: "A reversal cannot be reversed — add a new entry instead." };
  if (await db.staffLedgerEntry.findFirst({ where: { reversalOfId: e.id, deletedAt: null } })) return { error: "Already reversed" };
  const row = await db.staffLedgerEntry.create({
    data: {
      staffId: e.staffId,
      date: new Date(),
      kind: "REVERSAL",
      amount: e.amount,
      signedAmount: -e.signedAmount,
      description: `Reversal of ${e.description ?? e.kind} (${e.date.toLocaleDateString("en-IN")})`,
      reversalOfId: e.id,
      reason: reason.trim(),
      source: "MANUAL",
      createdByName: session.name,
    },
  });
  await db.auditLog.create({
    data: {
      entityType: "Staff",
      entityId: e.staffId,
      action: "MONEY_REVERSAL",
      summary: `Reversed ${e.kind} ₹${e.amount}: ${reason.trim()}`,
      actorName: session.name,
      actorEmail: session.email,
      meta: JSON.stringify({ reversedId: e.id, recordId: row.id }),
    },
  });
  refresh(e.staffId);
  return { ok: true as const };
}

const otSchema = z.object({
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  jobId: z.string().optional(),
  regularHours: z.number().min(0).max(24).default(8),
  otHours: z.number().positive().max(16),
  otRate: z.number().min(0).max(100_000).optional(),
  reason: z.string().trim().max(300).optional(),
});

/** Default OT rate per hour = day wage ÷ regular hours (monthly: monthly ÷ 30). Editable per record. */
async function defaultOtRate(staffId: string, regularHours: number) {
  const s = await db.staff.findUnique({ where: { id: staffId }, select: { dailyWage: true, monthlySalary: true, salaryType: true } });
  const day = s?.salaryType === "MONTHLY" && s.monthlySalary ? s.monthlySalary / 30 : (s?.dailyWage ?? 0);
  return regularHours > 0 ? Math.round((day / regularHours) * 100) / 100 : 0;
}

/** Overtime is stored separately and only counts once approved by the back office. */
export async function createOvertime(values: unknown) {
  const session = await guard();
  if (!session) return { error: "Not authorized" };
  const parsed = otSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid overtime" };
  const v = parsed.data;
  const rate = v.otRate ?? (await defaultOtRate(v.staffId, v.regularHours));
  const row = await db.overtimeRecord.create({
    data: {
      staffId: v.staffId,
      date: new Date(`${v.date}T12:00:00+05:30`),
      jobId: v.jobId || null,
      regularHours: v.regularHours,
      otHours: v.otHours,
      otRate: rate,
      otAmount: Math.round(v.otHours * rate * 100) / 100,
      reason: v.reason || null,
      createdByName: session.name,
    },
  });
  await db.auditLog.create({
    data: { entityType: "Staff", entityId: v.staffId, action: "OT_CREATED", summary: `Overtime ${v.otHours} h @ ₹${rate}/h (pending)`, actorName: session.name, actorEmail: session.email, meta: JSON.stringify({ recordId: row.id }) },
  });
  refresh(v.staffId);
  return { ok: true as const, id: row.id };
}

export async function decideOvertime(id: string, approve: boolean) {
  const session = await guard();
  if (!session) return { error: "Not authorized" };
  const ot = await db.overtimeRecord.findUnique({ where: { id } });
  if (!ot || ot.deletedAt || ot.status !== "PENDING") return { error: "Overtime is not pending" };
  await db.overtimeRecord.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", approvedByName: session.name, approvedAt: new Date() } });
  await db.auditLog.create({
    data: { entityType: "Staff", entityId: ot.staffId, action: approve ? "OT_APPROVED" : "OT_REJECTED", summary: `Overtime ₹${ot.otAmount} ${approve ? "approved" : "rejected"}`, actorName: session.name, actorEmail: session.email, meta: JSON.stringify({ recordId: id }) },
  });
  if (approve)
    await notifyStaff([ot.staffId], { kind: "STAFF_OVERTIME", title: `Overtime approved ₹${ot.otAmount.toLocaleString("en-IN")}`, body: `${ot.otHours} h`, href: "/my/records", recordId: id });
  refresh(ot.staffId);
  return { ok: true as const };
}

const payDetailsSchema = z.object({
  staffId: z.string().min(1),
  bankName: z.string().trim().max(120).optional(),
  bankAccountName: z.string().trim().max(120).optional(),
  bankAccount: z.string().trim().regex(/^[0-9]{0,20}$/, "Account number: digits only").optional(),
  bankIfsc: z.string().trim().toUpperCase().regex(/^([A-Z]{4}0[A-Z0-9]{6})?$/, "IFSC looks wrong").optional(),
  upiId: z.string().trim().max(120).optional(),
  gpayNumber: z.string().trim().regex(/^[0-9+ ]{0,15}$/, "Google Pay number looks wrong").optional(),
});

/** Employee payment account details — Super Admin / Accounts only. */
export async function saveStaffPaymentDetails(values: unknown) {
  const session = await guard();
  if (!session) return { error: "Not authorized" };
  const parsed = payDetailsSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  const { staffId, ...d } = parsed.data;
  await db.staff.update({
    where: { id: staffId },
    data: {
      bankName: d.bankName || null,
      bankAccountName: d.bankAccountName || null,
      bankAccount: d.bankAccount || null,
      bankIfsc: d.bankIfsc || null,
      upiId: d.upiId || null,
      gpayNumber: d.gpayNumber || null,
    },
  });
  // Never log the numbers themselves.
  await db.auditLog.create({ data: { entityType: "Staff", entityId: staffId, action: "PAYMENT_DETAILS_UPDATED", summary: "Payment account details updated", actorName: session.name, actorEmail: session.email } });
  revalidatePath(`/staff/${staffId}`);
  return { ok: true as const };
}

/** Office-side lists for the staff profile (manual entries + overtime). */
export async function getStaffMoneyAdmin(staffId: string) {
  const session = await guard();
  if (!session) return null;
  const [overtime, ledger, reversed] = await Promise.all([
    db.overtimeRecord.findMany({ where: { staffId, deletedAt: null }, orderBy: { date: "desc" }, take: 60 }),
    db.staffLedgerEntry.findMany({ where: { staffId, deletedAt: null, source: { not: "KHATABOOK" } }, orderBy: { date: "desc" }, take: 60 }),
    db.staffLedgerEntry.findMany({ where: { staffId, deletedAt: null, reversalOfId: { not: null } }, select: { reversalOfId: true } }),
  ]);
  const reversedIds = new Set(reversed.map((r) => r.reversalOfId));
  return { overtime, ledger: ledger.map((l) => ({ ...l, reversed: reversedIds.has(l.id) })) };
}
