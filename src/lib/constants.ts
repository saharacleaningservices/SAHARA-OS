export const COMPANY = {
  name: "Sahara Cleaning Services",
  website: "www.saharacleaningservices.com",
  phones: ["7083347130", "8956567130"],
  address: "Opp. South Gate, Magarpatta City, Hadapsar, Pune.",
  email: "contact@saharacleaningservices.com",
  gstin: "27AASFS1234A1Z5", // placeholder-format GSTIN — replace with the real registered number
  minimumJobValue: 3999,
  teamSize: 20,
};

export const SERVICE_LABELS: Record<string, string> = {
  HOME_DEEP_CLEANING: "Home Deep Cleaning",
  COMMERCIAL_CLEANING: "Commercial Cleaning",
  HOUSEKEEPING: "Housekeeping",
  PEST_CONTROL: "Pest Control",
  INTERIOR_PAINTING: "Interior Painting",
};

export const SERVICE_OPTIONS = Object.entries(SERVICE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// Smart Booking Form — service category → subcategory catalog, plus the
// legacy ServiceType each category maps to (kept for backward compatibility
// with existing reports/labels).
export const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  HOME_DEEP_CLEANING: "Home Deep Cleaning",
  INDIVIDUAL_CLEANING: "Individual Cleaning",
  PAINTING: "Painting",
  PEST_CONTROL: "Pest Control",
  COMMERCIAL_CLEANING: "Commercial Cleaning",
};

export const SERVICE_CATEGORY_TO_LEGACY: Record<string, string> = {
  HOME_DEEP_CLEANING: "HOME_DEEP_CLEANING",
  INDIVIDUAL_CLEANING: "HOUSEKEEPING",
  PAINTING: "INTERIOR_PAINTING",
  PEST_CONTROL: "PEST_CONTROL",
  COMMERCIAL_CLEANING: "COMMERCIAL_CLEANING",
};

// Reverse of the above — used wherever only the legacy ServiceType is known
// (e.g. Job.service) but a Phase 3 feature needs the newer ServiceCategory
// (upsell rules, AMC contracts).
export const LEGACY_TO_SERVICE_CATEGORY: Record<string, string> = {
  HOME_DEEP_CLEANING: "HOME_DEEP_CLEANING",
  HOUSEKEEPING: "INDIVIDUAL_CLEANING",
  INTERIOR_PAINTING: "PAINTING",
  PEST_CONTROL: "PEST_CONTROL",
  COMMERCIAL_CLEANING: "COMMERCIAL_CLEANING",
};

export const SERVICE_CATALOG: Record<string, string[]> = {
  HOME_DEEP_CLEANING: ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK", "Villa", "Bungalow"],
  INDIVIDUAL_CLEANING: ["Kitchen", "Bathroom", "Sofa", "Mattress", "Window", "Floor", "Fan", "Fridge", "Balcony"],
  PAINTING: [
    "Residential — Asian Oil Bond",
    "Residential — Tractor Emulsion",
    "Residential — Premium Emulsion",
    "Residential — Royale",
    "Residential — Royale Lustre",
    "Residential — Royale Shyne",
    "Residential — Exterior Paint",
    "Residential — Texture Paint",
    "Residential — Waterproofing",
    "Commercial — Asian Oil Bond",
    "Commercial — Tractor Emulsion",
    "Commercial — Premium Emulsion",
    "Commercial — Royale",
    "Commercial — Royale Lustre",
    "Commercial — Royale Shyne",
    "Commercial — Exterior Paint",
    "Commercial — Texture Paint",
    "Commercial — Waterproofing",
  ],
  PEST_CONTROL: [
    "Residential — Cockroach",
    "Residential — Bed Bug",
    "Residential — Rodent",
    "Residential — Termite",
    "Residential — Mosquito",
    "Residential — General Spray",
    "Commercial — Cockroach",
    "Commercial — Bed Bug",
    "Commercial — Rodent",
    "Commercial — Termite",
    "Commercial — Mosquito",
    "Commercial — General Spray",
  ],
  COMMERCIAL_CLEANING: [
    "Office Deep Cleaning",
    "Carpet Cleaning",
    "Chair Cleaning",
    "Glass Cleaning",
    "Facade Cleaning",
    "Industrial Cleaning",
  ],
};

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  CALL: "Call",
  WEBSITE: "Website",
  GOOGLE: "Google",
};

export const LEAD_SOURCE_OPTIONS = Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const LEAD_STAGES = [
  "NEW",
  "INTERESTED",
  "SITE_VISIT",
  "QUOTATION",
  "NEGOTIATION",
  "CONFIRMED",
  "JOB_SCHEDULED",
  "COMPLETED",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  INTERESTED: "Interested",
  SITE_VISIT: "Site Visit",
  QUOTATION: "Quotation",
  NEGOTIATION: "Negotiation",
  CONFIRMED: "Confirmed",
  JOB_SCHEDULED: "Job Scheduled",
  COMPLETED: "Completed",
};

// Booking time slots offered when a lead is confirmed.
export const TIME_SLOTS = [
  "8 AM",
  "9 AM",
  "10 AM",
  "11 AM",
  "12 PM",
  "1 PM",
  "2 PM",
  "3 PM",
  "4 PM",
  "5 PM",
] as const;

export const FOLLOWUP_TYPE_LABELS: Record<string, string> = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  SITE_VISIT: "Site Visit",
  PAYMENT: "Payment",
  CUSTOM: "Custom",
};

export const FOLLOWUP_TYPE_OPTIONS = Object.entries(FOLLOWUP_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const FOLLOWUP_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const FOLLOWUP_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const CALL_OUTCOMES = [
  "NO_ANSWER",
  "BUSY",
  "INTERESTED",
  "CALL_BACK",
  "CONFIRMED",
  "WRONG_NUMBER",
] as const;

export const CALL_OUTCOME_LABELS: Record<string, string> = {
  NO_ANSWER: "No Answer",
  BUSY: "Busy",
  INTERESTED: "Interested",
  CALL_BACK: "Call Back",
  CONFIRMED: "Confirmed",
  WRONG_NUMBER: "Wrong Number",
};

export const JOB_STATUSES = ["ASSIGNED", "ON_THE_WAY", "STARTED", "COMPLETED"] as const;

export const JOB_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Assigned",
  ON_THE_WAY: "On the Way",
  STARTED: "Started",
  COMPLETED: "Completed",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  DUE_SOON: "Due Soon",
  OVERDUE: "Overdue",
  PAID: "Paid",
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  CHEMICALS: "Chemicals",
  FUEL: "Fuel",
  EQUIPMENT: "Equipment",
  STAFF_ADVANCE: "Staff Advance",
  MISCELLANEOUS: "Miscellaneous",
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  OPERATIONS: "Operations Manager",
  ACCOUNTS: "Office Accountant",
  SUPERVISOR: "Team Leader",
  STAFF: "Worker",
};

// Route access matrix. Each role sees the modules relevant to their job;
// Admin always has full access. See src/lib/permissions.ts for the finer
// data-level scoping (own-team-only, today/tomorrow-only, no-salary, etc.)
// layered on top of this section-level matrix.
export const ROLE_NAV_ACCESS: Record<string, string[]> = {
  ADMIN: ["*"],
  OPERATIONS: ["dashboard", "jobs", "staff", "vehicles", "profile", "attendance", "amc"],
  ACCOUNTS: [
    "dashboard",
    "leads",
    "payments",
    "expenses",
    "profit",
    "reports",
    "customers",
    "assistant",
    "profile",
    "revenue",
    "amc",
  ],
  SUPERVISOR: ["dashboard", "jobs", "staff", "profile", "attendance"],
  STAFF: ["dashboard", "jobs", "profile", "attendance"],
};

export function canAccess(role: string, section: string) {
  const allowed = ROLE_NAV_ACCESS[role] || [];
  return allowed.includes("*") || allowed.includes(section);
}

export const STAFF_AVAILABILITY_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_JOB: "On Job",
  ON_LEAVE: "On Leave",
  OFF_DUTY: "Off Duty",
};

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
  LEAVE: "Leave",
};

export const QUOTATION_TERMS = `1. Prices are inclusive of standard materials & labour unless stated otherwise.
2. GST as applicable will be charged extra.
3. 50% advance payment confirms the booking; balance is due on job completion.
4. Rescheduling requires at least 24 hours' notice.
5. This quotation is valid for 7 days from the date of issue.
6. Minimum job value is ₹${3999}.`;

// ─────────────────────────────────────────────────────────────────────────
// Phase 3 — Revenue, WhatsApp & Workforce Automation
// ─────────────────────────────────────────────────────────────────────────

export const AMC_CATEGORY_LABELS: Record<string, string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
};

export const AMC_FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-Yearly",
  ANNUAL: "Annual",
};

// Residential AMCs are offered Quarterly/Half-Yearly/Annual; Commercial AMCs
// are offered Monthly/Quarterly/Annual, per the spec.
export const AMC_FREQUENCIES_BY_CATEGORY: Record<string, string[]> = {
  RESIDENTIAL: ["QUARTERLY", "HALF_YEARLY", "ANNUAL"],
  COMMERCIAL: ["MONTHLY", "QUARTERLY", "ANNUAL"],
};

export const AMC_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export const AMC_FREQUENCY_DAYS: Record<string, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  HALF_YEARLY: 182,
  ANNUAL: 365,
};

// Fine & Reward System — tracked categories (free-text on the DB row, fixed
// options in the UI so reporting stays consistent).
export const FINE_TYPES = [
  "Late Arrival",
  "Uniform Missing",
  "PPE Missing",
  "Gutkha",
  "Smoking",
  "Customer Complaint",
  "Before/After Photo Missing",
] as const;

export const REWARD_TYPES = [
  "On-Time",
  "Five-Star Review",
  "Zero Complaints (Month)",
] as const;
