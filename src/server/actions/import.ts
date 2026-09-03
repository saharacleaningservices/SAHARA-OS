"use server";

// Bulk CSV import for Leads and Staff. Mirrors createLead/createStaff's
// write logic (see src/server/actions/leads.ts and staff.ts) but processes
// rows sequentially in one transaction-free loop — so LD-/SCS- numbering
// stays correctly sequential — and revalidates paths once at the end
// instead of per row. Every row is re-validated against the same Zod
// schemas the manual forms use, even though the client already validated,
// since a server action must never trust its input.
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { leadSchema, staffSchema } from "@/lib/validation";
import { generateLeadNumber, generateEmployeeCode } from "@/lib/id-generators";

export type ImportRowResult = { row: number; status: "created" | "skipped" | "invalid"; message: string };
export type ImportSummary = { results: ImportRowResult[]; created: number };

export async function importLeads(rows: unknown[]): Promise<ImportSummary> {
  const session = await getSession();
  const results: ImportRowResult[] = [];
  let created = 0;

  // Defense in depth: a client-resolved assignedToId is trusted for display
  // but re-checked here against real users before it ever reaches a foreign
  // key, so a tampered/stale id can't crash the import mid-batch.
  const validUserIds = new Set((await db.user.findMany({ select: { id: true } })).map((u) => u.id));

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const parsed = leadSchema.safeParse(rows[i]);
    if (!parsed.success) {
      results.push({ row: rowNum, status: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid data" });
      continue;
    }
    const data = parsed.data;

    // Prevent duplicate mobile numbers — matches an existing lead by mobile
    // and skips the row rather than creating a second record for the same
    // customer.
    const existing = await db.lead.findFirst({ where: { mobile: data.mobile } });
    if (existing) {
      results.push({ row: rowNum, status: "skipped", message: `${data.name} — duplicate mobile, matches existing lead ${existing.leadNumber}` });
      continue;
    }

    const assignedToId = data.assignedToId && validUserIds.has(data.assignedToId) ? data.assignedToId : session?.sub;

    const leadNumber = await generateLeadNumber();
    const lead = await db.lead.create({
      data: {
        leadNumber,
        name: data.name,
        mobile: data.mobile,
        whatsapp: data.whatsapp || data.mobile,
        address: data.address || null,
        area: data.area,
        service: data.service,
        source: data.source,
        quoteAmount: data.quoteAmount ?? null,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        notes: data.notes || null,
        createdById: session?.sub,
        assignedToId,
      },
    });

    await db.activityLog.create({
      data: { leadId: lead.id, actorId: session?.sub, action: `Lead imported via CSV (${data.source})` },
    });

    if (data.followUpDate) {
      await db.followUp.create({
        data: {
          leadId: lead.id,
          dueDate: new Date(data.followUpDate),
          type: "CALL",
          notes: "Initial follow-up",
          assignedToId: session?.sub,
        },
      });
    }

    results.push({ row: rowNum, status: "created", message: `${data.name} imported as ${leadNumber}` });
    created++;
  }

  if (created > 0) {
    revalidatePath("/leads");
    revalidatePath("/dashboard");
  }
  return { results, created };
}

export async function importStaff(rows: unknown[]): Promise<ImportSummary> {
  const results: ImportRowResult[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const parsed = staffSchema.safeParse(rows[i]);
    if (!parsed.success) {
      results.push({ row: rowNum, status: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid data" });
      continue;
    }
    const data = parsed.data;

    const existing = await db.staff.findFirst({ where: { mobile: data.mobile } });
    if (existing) {
      results.push({ row: rowNum, status: "skipped", message: `${data.name} — duplicate mobile, matches existing staff ${existing.employeeCode}` });
      continue;
    }

    const employeeCode = await generateEmployeeCode();
    await db.staff.create({
      data: {
        employeeCode,
        name: data.name,
        mobile: data.mobile,
        designation: data.designation,
        salaryType: data.salaryType,
        dailyWage: data.salaryType === "DAILY" ? (data.dailyWage ?? null) : null,
        monthlySalary: data.salaryType === "MONTHLY" ? (data.monthlySalary ?? null) : null,
        notes: data.notes || null,
      },
    });

    results.push({ row: rowNum, status: "created", message: `${data.name} imported as ${employeeCode}` });
    created++;
  }

  if (created > 0) {
    revalidatePath("/staff");
  }
  return { results, created };
}
