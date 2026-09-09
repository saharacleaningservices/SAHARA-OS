// Shared, isomorphic (no "use client"/"use server") CSV/Excel import helpers.
//
// Header aliasing lets a file use reasonable alternate column names (e.g.
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

function mapRows(rawRows: Record<string, unknown>[], fieldAliases: Record<string, string[]>): CsvRow[] {
  const headerMap = buildHeaderMap(fieldAliases);
  return rawRows.map((row) => {
    const clean: CsvRow = {};
    for (const [header, value] of Object.entries(row)) {
      const key = headerMap[canonicalKey(header)] ?? canonicalKey(header);
      clean[key] = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
    }
    return clean;
  });
}

export function isExcelFile(filename: string): boolean {
  return /\.(xlsx|xls)$/i.test(filename);
}

export function parseCsv(text: string, fieldAliases: Record<string, string[]>): CsvRow[] {
  const parsed = Papa.parse<Record<string, unknown>>(text.trim(), {
    header: true,
    skipEmptyLines: "greedy",
  });
  return mapRows(parsed.data, fieldAliases);
}

// Parses the first sheet of an .xlsx/.xls workbook (as an ArrayBuffer) into
// the same row shape parseCsv produces, so both feed the same validators.
// The `xlsx` library (~300KB) is dynamically imported here so pages that
// only ever import CSV never pay for it in their initial bundle.
export async function parseExcel(buffer: ArrayBuffer, fieldAliases: Record<string, string[]>): Promise<CsvRow[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
    dateNF: "yyyy-mm-dd",
  });
  return mapRows(rawRows, fieldAliases);
}

function readFile(file: File, mode: "text" | "arraybuffer"): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.onload = () => resolve(reader.result as string | ArrayBuffer);
    if (mode === "arraybuffer") reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  });
}

// Reads a File (from an <input type="file">) with either parser, picked by
// extension. Shared by the Leads and Staff import dialogs.
export async function parseImportFile(file: File, fieldAliases: Record<string, string[]>): Promise<CsvRow[]> {
  if (isExcelFile(file.name)) {
    try {
      const buffer = await readFile(file, "arraybuffer");
      return await parseExcel(buffer as ArrayBuffer, fieldAliases);
    } catch {
      throw new Error("Couldn't read that Excel file — is it a valid .xlsx/.xls workbook?");
    }
  }
  const text = await readFile(file, "text");
  return parseCsv(String(text || ""), fieldAliases);
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
  assignedTo: ["assigned to", "assignedto", "assignee", "assigned", "owner"],
  followUpDate: ["follow up date", "followup date", "next follow up", "follow up"],
  notes: ["notes", "remarks", "comment", "comments"],
};

// Builds a case-insensitive "name" -> userId lookup for resolving the
// "Assigned To" column against real users (see getUsersForAssignment).
export function buildUserDirectory(users: { id: string; name: string }[]): Record<string, string> {
  const dir: Record<string, string> = {};
  for (const u of users) dir[u.name.trim().toLowerCase()] = u.id;
  return dir;
}

export function validateLeadRow(raw: CsvRow, userDirectory: Record<string, string> = {}): RowValidation<LeadFormValues> {
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
  let assignedToId = "";
  if (raw.assignedTo) {
    const match = userDirectory[raw.assignedTo.trim().toLowerCase()];
    if (!match) {
      return {
        ok: false,
        error: `Unrecognized "Assigned To" name "${raw.assignedTo}" — check spelling or leave the column blank`,
      };
    }
    assignedToId = match;
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
    assignedToId,
    followUpDate: raw.followUpDate ? new Date(raw.followUpDate).toISOString().slice(0, 10) : "",
    notes: raw.notes || "",
  };

  const parsed = leadSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid row" };
  }
  return { ok: true, data: parsed.data };
}

export const LEAD_TEMPLATE_HEADERS = ["Name", "Mobile", "WhatsApp", "Address", "Area", "Service", "Source", "Amount", "Assigned To", "Follow-up Date", "Notes"];
export const LEAD_TEMPLATE_SAMPLE_ROWS = [
  ["Priya Deshmukh", "9876543210", "9876543210", "B-12 Sunshine Apartments", "Kharadi", "Home Deep Cleaning", "Website", "5999", "Shoyab Shaikh", "2026-09-15", "Prefers weekend visit"],
  ["Rohan Traders", "9822011223", "", "Shop 4, MG Road", "Camp", "Commercial Cleaning", "Google", "12000", "", "", ""],
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

// ── Customers (bulk import — Excel / CSV / MyBillBook export) ─────────────

export type CustomerImportRow = {
  name: string;
  mobile: string;
  alternateMobile?: string;
  address?: string;
  area?: string;
  serviceHistory?: string;
  lastServiceDate?: string;
  outstandingBalance?: number;
  source?: string;
};

export const CUSTOMER_FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "customer name", "party name", "client name", "full name"],
  mobile: ["mobile", "phone", "phone number", "mobile number", "contact", "contact number", "party phone", "whatsapp"],
  alternateMobile: ["alternate mobile", "alternate phone", "alt mobile", "secondary phone", "phone 2", "other number"],
  address: ["address", "billing address", "shipping address", "full address", "customer address"],
  area: ["area", "locality", "location", "region", "city"],
  serviceHistory: ["service history", "services", "history", "past services", "work done"],
  lastServiceDate: ["last service date", "last service", "last visit", "last job date", "last invoice date"],
  outstandingBalance: ["outstanding balance", "outstanding", "balance", "closing balance", "due", "due amount", "pending amount"],
  source: ["source", "lead source", "reference", "referred by"],
};

function dateFrom(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim();
  // dd/mm/yyyy or dd-mm-yyyy → yyyy-mm-dd
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yr = y.length === 2 ? `20${y}` : y;
    return `${yr}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(t);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

export function validateCustomerRow(raw: CsvRow): RowValidation<CustomerImportRow> {
  if (!raw.name && !raw.mobile) return { ok: false, error: "Empty row" };
  const digits = (raw.mobile || "").replace(/[^\d]/g, "").slice(-10);
  if (digits.length !== 10) {
    return { ok: false, error: `Invalid mobile number "${raw.mobile ?? ""}" (need 10 digits)` };
  }
  const name = (raw.name || "").trim() || "Customer";
  return {
    ok: true,
    data: {
      name: name.slice(0, 120),
      mobile: digits,
      alternateMobile: (raw.alternateMobile || "").replace(/[^\d]/g, "").slice(-10) || undefined,
      address: raw.address?.trim() || undefined,
      area: raw.area?.trim() || undefined,
      serviceHistory: raw.serviceHistory?.trim() || undefined,
      lastServiceDate: dateFrom(raw.lastServiceDate),
      outstandingBalance: numberFrom(raw.outstandingBalance),
      source: raw.source?.trim() || undefined,
    },
  };
}

export const CUSTOMER_TEMPLATE_HEADERS = [
  "Name",
  "Mobile",
  "Alternate Mobile",
  "Address",
  "Area",
  "Service History",
  "Last Service Date",
  "Outstanding Balance",
  "Source",
];
export const CUSTOMER_TEMPLATE_SAMPLE_ROWS = [
  ["Rahul Verma", "9876543210", "9123456780", "A-401, Green Meadows, Kondhwa", "Kondhwa", "Home Deep Cleaning; Sofa Cleaning", "12/08/2026", "0", "Referral"],
  ["Anita Desai", "9812345678", "", "Shop 6, FC Road", "FC Road", "Commercial Cleaning", "01/07/2026", "1500", "MyBillBook"],
];
