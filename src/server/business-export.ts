// Monthly portable business-data export — 2026-09-22 master prompt §8-11.
// Owner-only (ADMIN). Queries the handful of tables that actually matter for
// business continuity/migration (customers, leads, bookings, jobs, payments,
// service history, staff, attendance, AMC), builds one XLSX workbook + a set
// of plain CSVs + a data dictionary + a README, zips them, and returns the
// zip as a Buffer — nothing is written to disk on the server (see
// src/app/api/export/business-data/route.ts, which streams the result
// straight back to the browser and keeps no temporary file around).
//
// Demo/seed rows (isDemo=true) are always excluded — they aren't real
// business data. Soft-deleted rows (deletedAt set) ARE included, each
// flagged with an "IsDeleted" column, because a customer's cancelled lead or
// a corrected payment is still real history that a recovery/migration export
// should not silently drop.

import * as XLSX from "xlsx";
import { categoryLabel } from "@/lib/contact-category";
import { normalizeMobile } from "@/server/customer-db";
import { unparse } from "papaparse";
import { db } from "@/lib/db";
import { COMPANY } from "@/lib/constants";

function csvDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
function csvDateTime(d: Date | null | undefined): string {
  return d ? d.toISOString() : "";
}

export type ExportDataset = { name: string; rows: Record<string, unknown>[] };

export async function collectBusinessExportDatasets(): Promise<ExportDataset[]> {
  const [customers, leads, jobs, payments, staff, attendance, amc, quotations, invoices] = await Promise.all([
    db.customer.findMany({ orderBy: { createdAt: "asc" } }),
    db.lead.findMany({ where: { isDemo: false }, orderBy: { createdAt: "asc" } }),
    db.job.findMany({ where: { isDemo: false }, orderBy: { createdAt: "asc" } }),
    db.payment.findMany({ where: { isDemo: false }, orderBy: { createdAt: "asc" } }),
    db.staff.findMany({ where: { isDemo: false }, orderBy: { createdAt: "asc" } }),
    db.attendance.findMany({ orderBy: { date: "asc" }, include: { staff: { select: { name: true, employeeCode: true } } } }),
    db.amcContract.findMany({ where: { isDemo: false }, orderBy: { createdAt: "asc" }, include: { visits: true } }),
    db.quotation.findMany({ orderBy: { createdAt: "asc" }, include: { lead: { select: { name: true, mobile: true } }, invoice: { select: { invoiceNumber: true } } } }),
    db.invoice.findMany({ orderBy: { createdAt: "asc" }, include: { job: { select: { jobNumber: true } }, quotation: { select: { quoteNumber: true } } } }),
  ]);

  const customersRows = customers.map((c) => ({
    "Customer ID": c.id,
    Name: c.name,
    "Primary Mobile": c.mobile,
    Category: categoryLabel(c.contactType),
    "Alternative Mobile": c.alternateMobile ?? "",
    Address: c.address ?? "",
    Area: c.area ?? "",
    "Last Service Date": csvDate(c.lastServiceDate),
    "Outstanding Balance": c.outstandingBalance,
    Source: c.source ?? "",
    Notes: c.notes ?? "",
    "Created At": csvDateTime(c.createdAt),
  }));

  const categoryByMobile = new Map(customers.map((c) => [normalizeMobile(c.mobile), categoryLabel(c.contactType)] as const));
  const leadsRows = leads.map((l) => ({
    "Lead ID": l.id,
    "Lead Number": l.leadNumber,
    Name: l.name,
    Mobile: l.mobile,
    Category: categoryByMobile.get(normalizeMobile(l.mobile)) ?? categoryLabel(null),
    "Alternative Mobile": l.alternateMobile ?? "",
    Email: l.email ?? "",
    Address: l.address ?? "",
    Area: l.area,
    Service: l.service,
    "Service Category": l.serviceCategory ?? "",
    "Service Variant": l.serviceVariant ?? "",
    Source: l.source,
    Stage: l.stage,
    "Quote Amount": l.quoteAmount ?? "",
    "Advance Amount": l.advanceAmount ?? "",
    "Payment Status": l.paymentStatus ?? "",
    "Service Date": csvDate(l.serviceDate),
    "Follow Up Date": csvDate(l.followUpDate),
    "Customer ID (by mobile)": l.mobile,
    IsDeleted: l.deletedAt ? "Y" : "N",
    "Created At": csvDateTime(l.createdAt),
  }));

  // "Bookings" = leads whose enquiry actually turned into a scheduled/serviced
  // job (CONFIRMED / JOB_SCHEDULED / COMPLETED) — distinct from the raw
  // enquiry funnel in Leads.csv and from the operational detail in Jobs.csv.
  const bookingStages = new Set(["CONFIRMED", "JOB_SCHEDULED", "COMPLETED"]);
  const bookingsRows = leads
    .filter((l) => bookingStages.has(l.stage))
    .map((l) => ({
      "Lead ID": l.id,
      "Booking Reference (Lead Number)": l.leadNumber,
      Customer: l.name,
      Mobile: l.mobile,
      Service: l.service,
      "Service Date": csvDate(l.serviceDate),
      "Time Slot": l.timeSlot ?? "",
      Stage: l.stage,
      "Quote Amount": l.quoteAmount ?? "",
      IsDeleted: l.deletedAt ? "Y" : "N",
    }));

  const jobsRows = jobs.map((j) => ({
    "Job ID": j.id,
    "Job Number": j.jobNumber,
    "Lead ID": j.leadId ?? "",
    Customer: j.customerName,
    Mobile: j.customerMobile,
    "Alternative Mobile": j.alternateMobile ?? "",
    Address: j.address,
    Area: j.area,
    Service: j.service,
    "Scheduled Date": csvDate(j.scheduledDate),
    "Scheduled Time": j.scheduledTime,
    Status: j.status,
    "Job Value": j.jobValue,
    "Completed At": csvDateTime(j.completedAt),
    IsDeleted: j.deletedAt ? "Y" : "N",
    "Created At": csvDateTime(j.createdAt),
  }));

  const paymentsRows = payments.map((p) => ({
    "Payment ID": p.id,
    "Invoice Number": p.invoiceNumber,
    "Job ID": p.jobId ?? "",
    "Lead ID": p.leadId ?? "",
    Customer: p.clientName,
    Mobile: p.clientMobile ?? "",
    Amount: p.amount,
    "Paid Amount": p.paidAmount,
    "Due Date": csvDate(p.dueDate),
    "Paid Date": csvDate(p.paidDate),
    Status: p.status,
    Mode: p.mode ?? "",
    "External Invoice #": p.mybillbookInvoiceNo ?? "",
    IsDeleted: p.deletedAt ? "Y" : "N",
    "Created At": csvDateTime(p.createdAt),
  }));

  // Friendly, human-readable service history — one row per completed job,
  // the shape a future CRM or spreadsheet user actually wants to read.
  const serviceHistoryRows = jobs
    .filter((j) => j.status === "COMPLETED")
    .map((j) => ({
      Customer: j.customerName,
      Mobile: j.customerMobile,
      Service: j.service,
      "Job Number": j.jobNumber,
      "Service Date": csvDate(j.scheduledDate),
      "Completed At": csvDateTime(j.completedAt),
      "Job Value": j.jobValue,
      Notes: j.notes ?? "",
    }));

  const staffRows = staff.map((s) => ({
    "Staff ID": s.id,
    "Employee Code": s.employeeCode,
    Name: s.name,
    Mobile: s.mobile,
    "Alternative Mobile": s.alternateMobile ?? "",
    Designation: s.designation,
    "Salary Type": s.salaryType,
    "Daily Wage": s.dailyWage ?? "",
    "Monthly Salary": s.monthlySalary ?? "",
    Availability: s.availability,
    "Join Date": csvDate(s.joinDate),
    "Bank Account": s.bankAccount ?? "",
    "Bank IFSC": s.bankIfsc ?? "",
    "GPay Number": s.gpayNumber ?? "",
    Active: s.isActive ? "Y" : "N",
    IsDeleted: s.deletedAt ? "Y" : "N",
  }));

  const attendanceRows = attendance.map((a) => ({
    "Attendance ID": a.id,
    "Employee Code": a.staff.employeeCode,
    "Staff Name": a.staff.name,
    Date: csvDate(a.date),
    Status: a.status,
    "Check In": csvDateTime(a.checkInTime),
    "Check Out": csvDateTime(a.checkOutTime),
    "Wage For Day": a.wageForDay ?? "",
  }));

  const amcRows = amc.map((a) => ({
    "AMC ID": a.id,
    "Contract Number": a.contractNumber,
    Customer: a.customerName,
    Mobile: a.customerMobile,
    Category: a.category,
    Frequency: a.frequency,
    Amount: a.amount,
    "Start Date": csvDate(a.startDate),
    "Next Visit Date": csvDate(a.nextVisitDate),
    "Last Visit Date": csvDate(a.lastVisitDate),
    "Contract Expiry": csvDate(a.contractExpiryDate),
    Status: a.status,
    "Visits Logged": a.visits.length,
    IsDeleted: a.deletedAt ? "Y" : "N",
  }));

  const quotationsRows = quotations.map((q) => ({
    "Quotation ID": q.id,
    "Quote Number": q.quoteNumber,
    "Lead ID": q.leadId,
    Customer: q.lead.name,
    Mobile: q.lead.mobile,
    "Sub Total": q.subTotal,
    Discount: q.discount,
    "GST %": q.gstPercent,
    "GST Amount": q.gstAmount,
    "Total Amount": q.totalAmount,
    Status: q.status,
    "Valid Till": csvDate(q.validTill),
    "Invoice Number": q.invoice?.invoiceNumber ?? "",
    "Created At": csvDateTime(q.createdAt),
  }));

  const invoicesRows = invoices.map((i) => ({
    "Invoice ID": i.id,
    "Invoice Number": i.invoiceNumber,
    "Job Number": i.job?.jobNumber ?? "",
    "Quote Number": i.quotation?.quoteNumber ?? "",
    Customer: i.customerName,
    Mobile: i.customerMobile ?? "",
    Address: i.customerAddress ?? "",
    "Sub Total": i.subTotal,
    Discount: i.discount,
    "GST %": i.gstPercent,
    "GST Amount": i.gstAmount,
    "Total Amount": i.totalAmount,
    Status: i.status,
    "Created At": csvDateTime(i.createdAt),
  }));

  return [
    { name: "Customers", rows: customersRows },
    { name: "Leads", rows: leadsRows },
    { name: "Bookings", rows: bookingsRows },
    { name: "Jobs", rows: jobsRows },
    { name: "Quotations", rows: quotationsRows },
    { name: "Invoices", rows: invoicesRows },
    { name: "Payments", rows: paymentsRows },
    { name: "Service_History", rows: serviceHistoryRows },
    { name: "Staff", rows: staffRows },
    { name: "Attendance", rows: attendanceRows },
    { name: "AMC", rows: amcRows },
  ];
}

export function buildWorkbook(datasets: ExportDataset[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of datasets) {
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, sheet, name.slice(0, 31));
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  return unparse(rows);
}

export function buildDataDictionary(datasets: ExportDataset[]): string {
  const lines = [
    "# Sahara OS — Business Data Export: Data Dictionary",
    "",
    "One sheet/CSV per business table. Every table's own ID column is stable",
    "and safe to use as a foreign key when migrating this data elsewhere —",
    "e.g. Payments.\"Job ID\" and Payments.\"Lead ID\" refer to Jobs.\"Job ID\"",
    "and Leads.\"Lead ID\" respectively. Do not rely on names alone to match",
    "records across files; a customer can share a name with someone else, a",
    "mobile number or ID cannot.",
    "",
    "## Tables",
    "",
    "- **Customers** — the imported/master customer list (name, mobile, address, area). Not every Lead/Job customer has a Customer row — most customer history lives on Leads/Jobs directly, grouped by mobile number.",
    "- **Leads** — every enquiry ever entered, regardless of outcome. `Stage` shows where it ended up (NEW/INTERESTED/.../CONFIRMED/COMPLETED/CANCELLED).",
    "- **Bookings** — the subset of Leads whose stage reached CONFIRMED, JOB_SCHEDULED or COMPLETED, i.e. enquiries that became a real booking.",
    "- **Jobs** — the operational record for a scheduled/completed service (crew, schedule, status, value). One Lead can have zero or one Job.",
    "- **Quotations** — pre-job estimates sent to a Lead (`Status`: Draft/Sent/Accepted/Rejected/Expired/Cancelled). `Invoice Number` is set once a Quotation is converted to an Invoice.",
    "- **Invoices** — billing records, either generated from a completed Job or created directly. `Status`: Draft/Issued/Partially Paid/Paid/Cancelled. `Job Number`/`Quote Number` link back to the originating Job/Quotation when set.",
    "- **Payments** — every payment/advance/invoice record. `Job ID`/`Lead ID` link back to the originating Job or Lead when set.",
    "- **Service_History** — a simplified, human-readable view of completed Jobs only (customer, service, date, value) — meant for quick reading, not further joining.",
    "- **Staff** — the employee roster, including salary/bank fields (this export is Owner-only; treat the downloaded file with the same care as any payroll document).",
    "- **Attendance** — one row per staff member per day marked.",
    "- **AMC** — Annual Maintenance Contracts, with a logged-visit count per contract.",
    "",
    "## Conventions",
    "",
    "- Dates are `YYYY-MM-DD`; timestamps are full ISO-8601 (UTC).",
    "- `IsDeleted` = \"Y\" means the record was soft-deleted (moved to Trash) inside Sahara OS but is still included here for completeness — filter these out if you only want currently-active records.",
    "- Demo/seed data (used for onboarding/testing inside Sahara OS) is always excluded from this export.",
    "- Blank cells mean the field was never filled in, not zero/false.",
    "",
    "## Row counts in this export",
    "",
    ...datasets.map((d) => `- ${d.name}: ${d.rows.length} row(s)`),
  ];
  return lines.join("\n");
}

export function buildReadme(monthLabel: string, datasets: ExportDataset[]): string {
  const totalRows = datasets.reduce((sum, d) => sum + d.rows.length, 0);
  return [
    `${COMPANY.name} — Business Data Export`,
    `Generated for: ${monthLabel}`,
    `Generated at: ${new Date().toISOString()}`,
    "",
    "WHAT'S IN THIS ZIP",
    "-------------------",
    "Sahara_Data_" + monthLabel + ".xlsx   One workbook, one sheet per table — open in Excel/Google Sheets for a quick read.",
    "*.csv                                 The same data, one plain CSV per table — for importing into another system.",
    "Data_Dictionary.md                    What each table/column means, and how tables relate to each other.",
    "README.txt                            This file.",
    "sahara_data.json                      The same data as structured JSON, if you need it for a script/migration tool.",
    "",
    `Total rows across all tables: ${totalRows}`,
    "",
    "WHAT'S NOT IN THIS ZIP (by design)",
    "-----------------------------------",
    "- Photos, videos and other media (see Sahara OS's Gallery/uploads folder separately if you need those).",
    "- Passwords, OTPs, API keys, tokens or any other secret/credential.",
    "- Application code, build artifacts or logs.",
    "",
    "This export is generated on demand from Settings by an Admin/Owner account and is not stored on the",
    `server after you download it. Keep this file somewhere safe — it contains real customer and payment data.`,
  ].join("\n");
}
