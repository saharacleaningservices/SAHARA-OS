"use server";

// Bulk CSV import for Leads and Staff. Mirrors createLead/createStaff's
// write logic (see src/server/actions/leads.ts and staff.ts) but processes
// rows sequentially in one transaction-free loop — so LD-/SCS- numbering
// stays correctly sequential — and revalidates paths once at the end
// instead of per row. Every row is re-validated against the same Zod
// schemas the manual forms use, even though the client already validated,
// since a server action must never trust its input.
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { leadSchema, staffSchema } from "@/lib/validation";
import type { CustomerImportRow } from "@/lib/csv-import";
import { deriveArea } from "@/lib/utils";
import { generateLeadNumber, generateEmployeeCode } from "@/lib/id-generators";
import { canExportCustomers } from "@/lib/permissions";

export type ImportRowResult = { row: number; status: "created" | "merged" | "skipped" | "invalid"; message: string };
export type ImportSummary = { results: ImportRowResult[]; created: number; merged?: number };

export async function importLeads(rows: unknown[]): Promise<ImportSummary> {
  const session = await getSession();
  // Bulk import is an administrative action, not day-to-day today/tomorrow
  // operational editing — blocked for Francis (SUPERVISOR) at the action
  // level too, not just by hiding the Import button (2026-09-21 policy).
  if (session?.role === "SUPERVISOR") {
    return { results: [{ row: 0, status: "invalid", message: "Not authorized" }], created: 0 };
  }
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
        area: deriveArea(data),
        pinCode: data.pinCode || null,
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
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
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

// ── Customers — bulk import with merge-by-mobile (Master Prompt v3.1) ──────

export async function importCustomers(rows: CustomerImportRow[]): Promise<ImportSummary> {
  const session = await getSession();
  // Francis (SUPERVISOR) must not touch the Customers database at all —
  // canExportCustomers is the shared "full Customers module capability"
  // check (ADMIN/ACCOUNTS/OPERATIONS), already excludes him.
  if (!session || !canExportCustomers(session.role)) {
    return { results: [{ row: 0, status: "invalid", message: "Not authorized" }], created: 0 };
  }

  const batchId = randomBytes(6).toString("hex");
  const results: ImportRowResult[] = [];
  let created = 0;
  let merged = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const r = rows[i];
    const mobile = (r.mobile || "").replace(/[^\d]/g, "").slice(-10);
    if (mobile.length !== 10) {
      results.push({ row: rowNum, status: "invalid", message: `Invalid mobile "${r.mobile ?? ""}"` });
      continue;
    }

    const existing = await db.customer.findUnique({ where: { mobile } });
    const lastDate = r.lastServiceDate ? new Date(r.lastServiceDate) : null;

    if (existing) {
      // Merge — fill blanks, keep the most recent service date, replace the
      // outstanding balance with the imported figure (source of truth), and
      // append new service history.
      const hist = [existing.serviceHistory, r.serviceHistory].filter(Boolean).join(" · ") || null;
      await db.customer.update({
        where: { id: existing.id },
        data: {
          name: existing.name && existing.name !== "Customer" ? existing.name : r.name,
          alternateMobile: existing.alternateMobile ?? r.alternateMobile ?? null,
          address: existing.address ?? r.address ?? null,
          area: existing.area ?? r.area ?? null,
          serviceHistory: hist,
          lastServiceDate:
            lastDate && (!existing.lastServiceDate || lastDate > existing.lastServiceDate)
              ? lastDate
              : existing.lastServiceDate,
          outstandingBalance: r.outstandingBalance != null ? r.outstandingBalance : existing.outstandingBalance,
          source: existing.source ?? r.source ?? null,
          importBatchId: batchId,
        },
      });
      results.push({ row: rowNum, status: "merged", message: `${r.name} merged into existing customer` });
      merged++;
      continue;
    }

    await db.customer.create({
      data: {
        name: r.name,
        mobile,
        alternateMobile: r.alternateMobile ?? null,
        address: r.address ?? null,
        area: r.area ?? null,
        serviceHistory: r.serviceHistory ?? null,
        lastServiceDate: lastDate,
        outstandingBalance: r.outstandingBalance ?? 0,
        source: r.source ?? null,
        importBatchId: batchId,
      },
    });
    results.push({ row: rowNum, status: "created", message: `${r.name} imported` });
    created++;
  }

  if (created > 0 || merged > 0) {
    revalidatePath("/customers");
    revalidatePath("/dashboard");
  }
  return { results, created, merged };
}
