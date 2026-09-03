// Shared, isomorphic (no "use client"/"use server") CSV import helpers.
//
// Header aliasing lets a CSV use reasonable alternate column names (e.g.
// "Phone" for "Mobile"). Row validation reuses the exact same Zod schemas
// the manual Lead/Staff forms use (leadSchema/staffSchema), so an imported
// row has to pass exactly the same rules as data typed in by hand — both
// here (for instant preview feedback) and again on the server (defense in
// depth against a tampered payload).
import Papa from "papaparse";
import { SERVICE_LABELS, LEAD_SOURCE_LABELS } from "@/lib/constants";
import { leadSchema, staffSchema, type LeadFormValues, type StaffFormValues } from "@/lib/validation";

export type CsvRow = Record<string, string>;
export type RowValidation<T> = { ok: true; data: T } | { ok: false; error: string };

function canonicalKey(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function buildHeaderMap(aliasGroups: Record<string, string[]>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(aliasGroups)) {
    for (const alias of aliases) map[canonicalKey(alias)] = canonical;
  }
  return map;
}

export function parseCsv(text: string, fieldAliases: Record<string, string[]>): CsvRow[] {
  const headerMap = buildHeaderMap(fieldAliases);
  const parsed = Papa.parse<CsvRow>(text.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => headerMap[canonicalKey(h)] ?? canonicalKey(h),
  });
  return parsed.data.map((row) => {
    const clean: CsvRow = {};
    for (const [key, value] of Object.entries(row)) {
      clean[key] = typeof value === "string" ? value.trim() : (value ?? "");
    }
    return clean;
  });
}

export function normalizeEnumValue(raw: string | undefined, labelMap: Record<string, string>): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const key = trimmed.toUpperCase().replace(/[\s-]+/g, "_");
  if (key in labelMap) return key;
  const found = Object.entries(labelMap).find(([, label]) => label.toLowerCase() === trimmed.toLowerCase());
  return found?.[0];
}

function isValidDateString(raw: string): boolean {
  return !Number.isNaN(Date.parse(raw));
}

function numberFrom(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isNaN(n) ? undefined : n;
}

// ── Leads ────────────────────────────────────────────────────────────────

export const LEAD_FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "customer name", "lead name"],
  mobile: ["mobile", "phone", "mobile number", "phone number", "contact", "contact number"],
  whatsapp: ["whatsapp", "whatsapp number"],
  address: ["address"],
  area: ["area", "locality", "location"],
  service: ["service", "service type"],
  source: ["source", "lead source"],
  quoteAmount: ["quote amount", "quoteamount", "budget", "amount", "estimated amount"],
  followUpDate: ["follow up date", "followup date", "next follow up", "follow up"],
  notes: ["notes", "remarks", "comment", "comments"],
};

export function validateLeadRow(raw: CsvRow): RowValidation<LeadFormValues> {
  if (!raw.name && !raw.mobile && !raw.area) return { ok: false, error: "Empty row" };

  const missing = [
    !raw.name && "Name",
    !raw.mobile && "Mobile",
    !raw.area && "Area",
    !raw.service && "Service",
    !raw.source && "Source",
  ].filter(Boolean) as string[];
  if (missing.length > 0) {
    return { ok: false, error: `Missing required column(s): ${missing.join(", ")}` };
  }

  const service = normalizeEnumValue(raw.service, SERVICE_LABELS);
  if (!service) {
    return { ok: false, error: `Unrecognized service "${raw.service}" — expected one of: ${Object.values(SERVICE_LABELS).join(", ")}` };
  }
  const source = normalizeEnumValue(raw.source, LEAD_SOURCE_LABELS);
  if (!source) {
    return { ok: false, error: `Unrecognized source "${raw.source}" — expected one of: ${Object.values(LEAD_SOURCE_LABELS).join(", ")}` };
  }
  if (raw.followUpDate && !isValidDateString(raw.followUpDate)) {
    return { ok: false, error: `Unrecognized date "${raw.followUpDate}" — use YYYY-MM-DD` };
  }

  const candidate = {
    name: raw.name,
    mobile: raw.mobile,
    whatsapp: raw.whatsapp || "",
    address: raw.address || "",
    area: raw.area,
    service,
    source,
    quoteAmount: numberFrom(raw.quoteAmount),
    followUpDate: raw.followUpDate ? new Date(raw.followUpDate).toISOString().slice(0, 10) : "",
    notes: raw.notes || "",
  };

  const parsed = leadSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid row" };
  }
  return { ok: true, data: parsed.data };
}

export const LEAD_TEMPLATE_HEADERS = ["Name", "Mobile", "WhatsApp", "Address", "Area", "Service", "Source", "Quote Amount", "Follow-up Date", "Notes"];
export const LEAD_TEMPLATE_SAMPLE_ROWS = [
  ["Priya Deshmukh", "9876543210", "9876543210", "B-12 Sunshine Apartments", "Kharadi", "Home Deep Cleaning", "Website", "5999", "2026-09-15", "Prefers weekend visit"],
  ["Rohan Traders", "9822011223", "", "Shop 4, MG Road", "Camp", "Commercial Cleaning", "Referral", "12000", "", ""],
];

// ── Staff ────────────────────────────────────────────────────────────────

export const STAFF_FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "employee name"],
  mobile: ["mobile", "phone", "mobile number", "contact"],
  designation: ["designation", "role", "position"],
  salaryType: ["salary type", "salarytype", "pay type"],
  dailyWage: ["daily wage", "wage", "daily rate"],
  monthlySalary: ["monthly salary", "salary"],
  notes: ["notes", "remarks", "comment", "comments"],
};

const SALARY_TYPE_LABELS: Record<string, string> = { DAILY: "Daily", MONTHLY: "Monthly" };

export function validateStaffRow(raw: CsvRow): RowValidation<StaffFormValues> {
  if (!raw.name && !raw.mobile) return { ok: false, error: "Empty row" };

  const missing = [!raw.name && "Name", !raw.mobile && "Mobile", !raw.designation && "Designation"].filter(Boolean) as string[];
  if (missing.length > 0) {
    return { ok: false, error: `Missing required column(s): ${missing.join(", ")}` };
  }

  let salaryType = normalizeEnumValue(raw.salaryType, SALARY_TYPE_LABELS);
  if (raw.salaryType && !salaryType) {
    return { ok: false, error: `Unrecognized salary type "${raw.salaryType}" — expected Daily or Monthly` };
  }
  if (!salaryType) {
    salaryType = raw.monthlySalary && !raw.dailyWage ? "MONTHLY" : "DAILY";
  }

  const candidate = {
    name: raw.name,
    mobile: raw.mobile,
    designation: raw.designation,
    salaryType,
    dailyWage: numberFrom(raw.dailyWage),
    monthlySalary: numberFrom(raw.monthlySalary),
    notes: raw.notes || "",
  };

  const parsed = staffSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid row" };
  }
  return { ok: true, data: parsed.data };
}

export const STAFF_TEMPLATE_HEADERS = ["Name", "Mobile", "Designation", "Salary Type", "Daily Wage", "Monthly Salary", "Notes"];
export const STAFF_TEMPLATE_SAMPLE_ROWS = [
  ["Ganesh More", "9812345670", "Cleaning Executive", "Daily", "650", "", "Available weekends"],
  ["Sunita Kale", "9812345671", "Supervisor", "Monthly", "", "18000", ""],
];
