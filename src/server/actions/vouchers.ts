"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { VOUCHER_META, VOUCHER_TYPES } from "@/lib/vouchers";
import { cancelVoucher, createVoucher, recordPurchasePayment } from "@/server/vouchers";

const lineSchema = z.object({ name: z.string().trim().min(1).max(200), description: z.string().trim().max(500).optional(), qty: z.number().positive().max(100000), rate: z.number().min(0).max(100000000) });
const schema = z.object({
  type: z.enum(VOUCHER_TYPES),
  voucherDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partyName: z.string().trim().min(2).max(160),
  partyMobile: z.string().trim().max(20).optional(),
  partyGstin: z.string().trim().max(20).optional(),
  partyAddress: z.string().trim().max(400).optional(),
  customerId: z.string().max(60).optional(),
  refNumber: z.string().trim().max(60).optional(),
  lines: z.array(lineSchema).min(1).max(40),
  discount: z.number().min(0).max(100000000).default(0),
  isGst: z.boolean(),
  gstPercent: z.number().min(0).max(28),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional(),
});

/** Money documents and purchase vouchers: Super Admin and Accounts only (same as invoices). */
async function guard() {
  const session = await getSession();
  return session && (session.role === "ADMIN" || session.role === "ACCOUNTS") ? session : null;
}
const at = (d: string) => new Date(`${d}T06:30:00Z`); // noon IST, so the calendar day is the same in any timezone

export async function createVoucherAction(values: unknown) {
  const session = await guard();
  if (!session) return { success: false as const, error: "Only Super Admin and Accounts can create vouchers." };
  const p = schema.safeParse(values);
  if (!p.success) return { success: false as const, error: p.error.issues[0]?.message ?? "Please check the form." };
  const d = p.data;
  if (VOUCHER_META[d.type].hasMoney && d.lines.every((l) => l.rate === 0)) return { success: false as const, error: "Add at least one line with a rate." };
  const mobile10 = (d.partyMobile ?? "").replace(/\D/g, "").slice(-10);
  const known = d.customerId ?? (mobile10.length === 10 && d.type !== "PURCHASE" ? (await db.customer.findUnique({ where: { mobile: mobile10 }, select: { id: true } }))?.id : undefined);
  const v = await createVoucher({
    type: d.type,
    voucherDate: at(d.voucherDate),
    partyName: d.partyName,
    partyMobile: d.partyMobile,
    partyGstin: d.partyGstin,
    partyAddress: d.partyAddress,
    customerId: known,
    refNumber: d.refNumber,
    lines: d.lines.map((l) => ({ ...l, rate: VOUCHER_META[d.type].hasMoney ? l.rate : 0 })),
    discount: VOUCHER_META[d.type].hasMoney ? d.discount : 0,
    isGst: VOUCHER_META[d.type].hasMoney ? d.isGst : false,
    gstPercent: d.gstPercent,
    dueDate: d.dueDate ? at(d.dueDate) : null,
    notes: d.notes,
    createdByName: session.name,
  });
  await db.auditLog.create({ data: { entityType: "Voucher", entityId: v.id, action: "CREATE", summary: `${session.name} created ${v.number} (${VOUCHER_META[d.type].label}) for ${v.partyName}`, actorName: session.name, actorEmail: session.email } }).catch(() => {});
  revalidatePath(`/vouchers/${VOUCHER_META[d.type].slug}`);
  revalidatePath("/dashboard");
  return { success: true as const, id: v.id, number: v.number };
}

export async function payPurchaseVoucher(id: string, amount: number) {
  const session = await guard();
  if (!session) return { success: false as const, error: "Only Super Admin and Accounts can do this." };
  const r = await recordPurchasePayment(String(id), Number(amount));
  if (!r.ok) return { success: false as const, error: r.error };
  await db.auditLog.create({ data: { entityType: "Voucher", entityId: String(id), action: "PAYMENT_OUT", summary: `${session.name} recorded ₹${amount} paid on a purchase voucher`, actorName: session.name, actorEmail: session.email } }).catch(() => {});
  revalidatePath("/vouchers/purchase-voucher");
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function cancelVoucherAction(id: string) {
  const session = await guard();
  if (!session) return { success: false as const, error: "Only Super Admin and Accounts can do this." };
  const r = await cancelVoucher(String(id));
  if (!r.ok) return { success: false as const, error: r.error };
  await db.auditLog.create({ data: { entityType: "Voucher", entityId: String(id), action: "CANCEL", summary: `${session.name} cancelled a voucher`, actorName: session.name, actorEmail: session.email } }).catch(() => {});
  for (const t of VOUCHER_TYPES) revalidatePath(`/vouchers/${VOUCHER_META[t].slug}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}
