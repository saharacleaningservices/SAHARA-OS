"use server";

// Money Khata — employee money (add / correct: Super Admin + Accounts only).
// - One entry screen: type + mode + reference/UPI + note.
// - Records are never edited or deleted: a correction adds a reversal that
//   points at the original plus, when needed, the corrected new entry, and
//   is audit-logged as Old → New → Reason → Edited by → Date/time.
// - Duplicates are refused (exact repeat within 2 minutes) or need an explicit
//   confirmation (same type/amount/date already in the Khata).
// - Auto Fare exists only for Kaleem (SCS-0004) — refused for anyone else.
// - Balance is always computed from transactions (server/staff-balance.ts).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canManageStaffFinancials } from "@/lib/permissions";
import { notifyStaff } from "@/server/staff-notify";
import { autoFareAllowed } from "@/lib/staff-money-rules";

const MODES = ["CASH", "UPI", "GOOGLE_PAY", "BANK_TRANSFER", "OTHER"] as const;
// LOAN / LOAN_RECOVERY go to the separate loan ledger; the rest to the salary ledger.
const TYPES = ["SALARY", "ADVANCE", "LOAN", "LOAN_RECOVERY", "EXPENSE", "ADJUSTMENT", "BONUS", "OTHER", "AUTO_FARE"] as const;
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
  AUTO_FARE: "Auto fare",
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
  // Kept for old clients only — a loan recovery reduces ONLY the loan, never Salary Due.
  fromSalary: z.boolean().optional(),
  // The same type/amount/date already exists — the office confirmed it is a separate entry.
  confirmDuplicate: z.boolean().optional(),
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
  if (v.type === "AUTO_FARE" && !autoFareAllowed(staff.employeeCode)) return { error: "Auto fare applies only to Kaleem (SCS-0004)." };
  if ((v.type === "ADJUSTMENT" || v.type === "OTHER") && (!v.direction || !v.note)) return { error: "Adjustment needs a direction and a reason" };
  const when = new Date(`${v.date}T12:00:00+05:30`);
  const text = [LABEL[v.type], v.note].filter(Boolean).join(" · ");
  const isLoan = v.type === "LOAN" || v.type === "LOAN_RECOVERY";
  // Double-submit guard: the same entry (staff, amount, date, description) saved again
  // within 2 minutes is refused, so a double tap can never create two financial rows.
  const since = new Date(Date.now() - 2 * 60 * 1000);
  const twin = isLoan
    ? await db.staffLoanEntry.findFirst({ where: { staffId: staff.id, amount: v.amount, date: when, source: "MANUAL", deletedAt: null, createdAt: { gte: since }, description: { startsWith: text } } })
    : await db.staffLedgerEntry.findFirst({ where: { staffId: staff.id, amount: v.amount, date: when, kind: v.type === "SALARY" ? "SALARY_PAID" : v.type, source: "MANUAL", deletedAt: null, createdAt: { gte: since } } });
  if (twin) return { error: "This entry was just saved — check the ledger before adding it again." };
  // Same type + amount + date already in the Khata (any time) → only with an explicit confirmation.
  if (!v.confirmDuplicate) {
    const day0 = new Date(`${v.date}T00:00:00+05:30`);
    const day1 = new Date(day0.getTime() + 86_400_000);
    const same = isLoan
      ? await db.staffLoanEntry.findFirst({ where: { staffId: staff.id, amount: v.amount, kind: v.type === "LOAN" ? "LOAN_GIVEN" : "LOAN_REPAID", date: { gte: day0, lt: day1 }, deletedAt: null } })
      : await db.staffLedgerEntry.findFirst({ where: { staffId: staff.id, amount: v.amount, kind: v.type === "SALARY" ? "SALARY_PAID" : v.type, date: { gte: day0, lt: day1 }, deletedAt: null } });
    if (same)
      return {
        duplicate: true as const,
        error: `A ${LABEL[v.type].toLowerCase()} of ₹${v.amount.toLocaleString("en-IN")} on this date is already in the Khata. Save it again only if it is a separate payment.`,
      };
  }
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
        fromSalary: false,
        description: [text, v.mode, v.reference ? `Ref ${v.reference}` : null].filter(Boolean).join(" · "),
        source: "MANUAL",
        createdByName: session.name,
      },
    });
    createdId = row.id;
  } else {
    // + = owed to the worker (credit), − = paid to the worker (debit)
    const owed =
      v.type === "EXPENSE" || v.type === "BONUS" || v.type === "AUTO_FARE" || ((v.type === "ADJUSTMENT" || v.type === "OTHER") && v.direction === "OWED_TO_WORKER");
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

const correctionSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(300).optional(),
});
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const atNoon = (d: string) => new Date(`${d}T12:00:00+05:30`);

/**
 * Correct one Khata entry (salary ledger or loan ledger). The original row is
 * never edited or deleted: a reversal row (opposite sign, pointing at it) is
 * added, then — unless the entry is being cancelled (next = null) — the
 * corrected new row. Audit: Old → New → Reason → Edited by → Date/time.
 */
export async function correctStaffEntry(input: { table: "ledger" | "loan"; id: string; next: unknown | null; reason: string }) {
  const session = await guard();
  if (!session) return { error: "Not authorized" };
  const reason = input.reason?.trim();
  if (!reason) return { error: "Reason is required" };
  let next: z.infer<typeof correctionSchema> | null = null;
  if (input.next) {
    const p = correctionSchema.safeParse(input.next);
    if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid corrected entry" };
    next = p.data;
  }

  if (input.table === "ledger") {
    const e = await db.staffLedgerEntry.findUnique({ where: { id: input.id }, include: { staff: { select: { employeeCode: true, name: true } } } });
    if (!e || e.deletedAt) return { error: "Entry not found" };
    if (e.kind === "REVERSAL") return { error: "A reversal cannot be corrected — correct the original entry." };
    if (e.kind === "AUTO_FARE" && !autoFareAllowed(e.staff.employeeCode)) return { error: "Auto fare applies only to Kaleem (SCS-0004)." };
    if (await db.staffLedgerEntry.findFirst({ where: { reversalOfId: e.id, deletedAt: null } })) return { error: "This entry was already corrected — correct the new entry instead." };
    if (next && next.amount === e.amount && next.date === ymd(e.date) && !next.note) return { error: "Nothing changed" };
    const result = await db.$transaction(async (tx) => {
      const rev = await tx.staffLedgerEntry.create({
        data: {
          staffId: e.staffId,
          date: e.date,
          kind: "REVERSAL",
          amount: e.amount,
          signedAmount: -e.signedAmount,
          description: `Correction of ${e.description ?? e.kind} (${e.date.toLocaleDateString("en-IN")})`,
          reversalOfId: e.id,
          reason,
          source: "MANUAL",
          createdByName: session.name,
        },
      });
      const fresh = next
        ? await tx.staffLedgerEntry.create({
            data: {
              staffId: e.staffId,
              date: atNoon(next.date),
              kind: e.kind,
              amount: next.amount,
              signedAmount: (e.signedAmount < 0 ? -1 : 1) * next.amount,
              description: next.note || e.description,
              paymentMode: e.paymentMode,
              reference: e.reference,
              upiId: e.upiId,
              reason: `Corrected entry — ${reason}`,
              source: "MANUAL",
              createdByName: session.name,
            },
          })
        : null;
      return { rev, fresh };
    });
    await auditCorrection(session, e.staffId, e.staff, {
      table: "ledger",
      kind: e.kind,
      old: { amount: e.amount, date: ymd(e.date), text: e.description },
      next,
      reason,
      ids: { original: e.id, reversal: result.rev.id, corrected: result.fresh?.id ?? null },
    });
    refresh(e.staffId);
    return { ok: true as const };
  }

  const l = await db.staffLoanEntry.findUnique({ where: { id: input.id }, include: { staff: { select: { employeeCode: true, name: true } } } });
  if (!l || l.deletedAt) return { error: "Entry not found" };
  if (l.kind === "LOAN_CORRECTION") return { error: "A correction cannot be corrected — correct the original entry." };
  if (await db.staffLoanEntry.findFirst({ where: { reversalOfId: l.id, deletedAt: null } })) return { error: "This entry was already corrected — correct the new entry instead." };
  if (next && next.amount === l.amount && next.date === ymd(l.date) && !next.note) return { error: "Nothing changed" };
  // The loan can never go below zero after a correction.
  const sign = l.signedAmount < 0 ? -1 : 1;
  const out = await db.staffLoanEntry.aggregate({ where: { staffId: l.staffId, deletedAt: null }, _sum: { signedAmount: true } });
  const after = (out._sum.signedAmount ?? 0) - l.signedAmount + (next ? sign * next.amount : 0);
  if (after < -0.001) return { error: "After this correction the recoveries would be more than the loan." };
  const result = await db.$transaction(async (tx) => {
    const rev = await tx.staffLoanEntry.create({
      data: {
        staffId: l.staffId,
        date: l.date,
        kind: "LOAN_CORRECTION",
        amount: l.amount,
        signedAmount: -l.signedAmount,
        description: `Correction of ${l.description ?? l.kind} (${l.date.toLocaleDateString("en-IN")})`,
        reversalOfId: l.id,
        reason,
        source: "MANUAL",
        createdByName: session.name,
      },
    });
    const fresh = next
      ? await tx.staffLoanEntry.create({
          data: {
            staffId: l.staffId,
            date: atNoon(next.date),
            kind: l.kind,
            amount: next.amount,
            signedAmount: sign * next.amount,
            description: next.note || l.description,
            reason: `Corrected entry — ${reason}`,
            source: "MANUAL",
            createdByName: session.name,
          },
        })
      : null;
    return { rev, fresh };
  });
  await auditCorrection(session, l.staffId, l.staff, {
    table: "loan",
    kind: l.kind,
    old: { amount: l.amount, date: ymd(l.date), text: l.description },
    next,
    reason,
    ids: { original: l.id, reversal: result.rev.id, corrected: result.fresh?.id ?? null },
  });
  refresh(l.staffId);
  return { ok: true as const };
}

type CorrectionAudit = {
  table: "ledger" | "loan";
  kind: string;
  old: { amount: number; date: string; text: string | null };
  next: { amount: number; date: string; note?: string } | null;
  reason: string;
  ids: { original: string; reversal: string; corrected: string | null };
};

async function auditCorrection(session: { name: string; email: string }, staffId: string, staff: { employeeCode: string | null; name: string }, c: CorrectionAudit) {
  const newText = c.next ? `₹${c.next.amount} (${c.next.date})` : "cancelled";
  await db.auditLog.create({
    data: {
      entityType: "Staff",
      entityId: staffId,
      action: "MONEY_CORRECTION",
      summary: `${staff.employeeCode ?? ""} ${staff.name}: ${c.kind} ₹${c.old.amount} (${c.old.date}) → ${newText} · Reason: ${c.reason}`.trim(),
      actorName: session.name,
      actorEmail: session.email,
      meta: JSON.stringify(c),
    },
  });
  await notifyStaff([staffId], {
    kind: c.table === "loan" ? "STAFF_LOAN" : "STAFF_PAYMENT",
    title: `Correction: ${c.kind.replaceAll("_", " ").toLowerCase()} ₹${c.old.amount.toLocaleString("en-IN")} → ${newText}`,
    body: c.reason,
    href: "/my/records?tab=ledger",
    recordId: c.ids.reversal,
  });
}

/** Older clients: cancel an entry with a reason (same as a correction to "cancelled"). */
export async function reverseStaffTransaction(entryId: string, reason: string) {
  return correctStaffEntry({ table: "ledger", id: entryId, next: null, reason });
}

/** Audit History tab: every money / overtime / payment-details change for one employee, newest first. */
export async function getStaffMoneyAudit(staffId: string) {
  const session = await guard();
  if (!session) return [];
  const rows = await db.auditLog.findMany({
    where: { entityType: "Staff", entityId: staffId, OR: [{ action: { startsWith: "MONEY_" } }, { action: { startsWith: "OT_" } }, { action: "PAYMENT_DETAILS_UPDATED" }] },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, action: true, summary: true, actorName: true, createdAt: true, meta: true },
  });
  return rows.map((r) => {
    let old: string | null = null;
    let next: string | null = null;
    let reason: string | null = null;
    if (r.action === "MONEY_CORRECTION" && r.meta) {
      try {
        const m = JSON.parse(r.meta) as CorrectionAudit;
        old = `₹${m.old.amount.toLocaleString("en-IN")} · ${m.old.date}${m.old.text ? ` · ${m.old.text}` : ""}`;
        next = m.next ? `₹${m.next.amount.toLocaleString("en-IN")} · ${m.next.date}${m.next.note ? ` · ${m.next.note}` : ""}` : "Cancelled";
        reason = m.reason;
      } catch {
        /* summary only */
      }
    }
    return { id: r.id, action: r.action, summary: r.summary, by: r.actorName, at: r.createdAt, old, next, reason };
  });
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
