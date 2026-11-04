"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { validPhoneKey } from "@/lib/phone";
import { cleanPartyName } from "@/lib/party-name.mjs";
import { clampCommission, splitCommission } from "@/lib/vendor-commission";

/** Vendor commission is financial data — Super Admin + Accounts only (same as Expenses). */
function canManageVendors(role: string | undefined): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

const vendorSchema = z.object({
  name: z.string().trim().min(2, "Vendor name is required").max(120),
  phone: z.string().trim().min(8, "Enter the vendor's mobile number").max(20),
  services: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  commissionPct: z.coerce.number().min(20, "Sahara commission is 20–25 %").max(25, "Sahara commission is 20–25 %").default(20),
  notes: z.string().max(500).optional().or(z.literal("")),
});

const payoutSchema = z.object({
  vendorId: z.string().min(1),
  service: z.string().max(80).optional().or(z.literal("")),
  jobRef: z.string().max(120).optional().or(z.literal("")),
  grossAmount: z.coerce.number().positive("Enter the job value"),
  commissionPct: z.coerce.number().min(20).max(25).optional(),
  paidDate: z.string().optional().or(z.literal("")),
  mode: z.enum(["UPI", "BANK", "CASH"]).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type Result = { success: true; id?: string } | { success: false; error: string };

const revalidate = () => {
  revalidatePath("/vendors");
  revalidatePath("/expenses");
  revalidatePath("/profit");
  revalidatePath("/dashboard");
};

export async function saveVendor(id: string | null, values: unknown): Promise<Result> {
  const session = await getSession();
  if (!canManageVendors(session?.role)) return { success: false, error: "Not authorized" };
  const parsed = vendorSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const d = parsed.data;
  const phone = validPhoneKey(d.phone);
  if (!phone) return { success: false, error: "Invalid mobile number" };
  const data = {
    name: cleanPartyName(d.name).name || d.name,
    phone,
    services: d.services.length ? JSON.stringify([...new Set(d.services)]) : null,
    commissionPct: clampCommission(d.commissionPct),
    notes: d.notes?.trim() || null,
  };
  const clash = await db.vendor.findUnique({ where: { phone }, select: { id: true, name: true } });
  if (clash && clash.id !== id) return { success: false, error: `This number is already registered to vendor ${clash.name}` };
  const row = id ? await db.vendor.update({ where: { id }, data }) : await db.vendor.create({ data });
  revalidate();
  return { success: true, id: row.id };
}

export async function setVendorActive(id: string, active: boolean): Promise<Result> {
  const session = await getSession();
  if (!canManageVendors(session?.role)) return { success: false, error: "Not authorized" };
  await db.vendor.update({ where: { id }, data: { active } });
  revalidate();
  return { success: true };
}

/**
 * Records a vendor payout: the split is recomputed on the server (never trusted from the
 * browser) and the vendor's share is booked as ONE Expense row with category
 * VENDOR_PAYMENT, linked by expenseId — both rows or neither.
 */
export async function recordVendorPayout(values: unknown): Promise<Result> {
  const session = await getSession();
  if (!canManageVendors(session?.role)) return { success: false, error: "Not authorized" };
  const parsed = payoutSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const d = parsed.data;
  const vendor = await db.vendor.findUnique({ where: { id: d.vendorId } });
  if (!vendor) return { success: false, error: "Vendor not found" };
  if (!vendor.active) return { success: false, error: "This vendor is inactive — reactivate before recording a payout" };
  const split = splitCommission(d.grossAmount, d.commissionPct ?? vendor.commissionPct);
  if (split.vendorShare <= 0) return { success: false, error: "Payout amount must be more than ₹0" };
  const paidDate = d.paidDate ? new Date(d.paidDate) : new Date();
  if (Number.isNaN(paidDate.getTime())) return { success: false, error: "Invalid payout date" };

  const description = [
    `Vendor payout — ${vendor.name}`,
    d.service || null,
    d.jobRef ? `Job ${d.jobRef}` : null,
    `job value ₹${split.gross.toLocaleString("en-IN")}, Sahara ${split.commissionPct}% = ₹${split.saharaShare.toLocaleString("en-IN")}`,
  ].filter(Boolean).join(" · ");

  const payout = await db.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        category: "VENDOR_PAYMENT",
        description: description.slice(0, 500),
        amount: split.vendorShare,
        date: paidDate,
        paidTo: vendor.name,
        addedById: session?.sub,
      },
    });
    return tx.vendorPayout.create({
      data: {
        vendorId: vendor.id,
        service: d.service || null,
        jobRef: d.jobRef || null,
        grossAmount: split.gross,
        commissionPct: split.commissionPct,
        saharaShare: split.saharaShare,
        vendorShare: split.vendorShare,
        paidDate,
        mode: d.mode || null,
        expenseId: expense.id,
        notes: d.notes?.trim() || null,
        createdById: session?.sub,
      },
    });
  });
  revalidate();
  return { success: true, id: payout.id };
}
