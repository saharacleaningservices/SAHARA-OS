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
  PAINTING: "Interior Painting",
  PEST_CONTROL: "Pest Control",
  HOUSEKEEPING: "Housekeeping",
  COMMERCIAL_CLEANING: "Commercial Cleaning",
  AMC: "AMC / Annual Contract",
};

export const SERVICE_CATEGORY_TO_LEGACY: Record<string, string> = {
  HOME_DEEP_CLEANING: "HOME_DEEP_CLEANING",
  INDIVIDUAL_CLEANING: "HOUSEKEEPING",
  PAINTING: "INTERIOR_PAINTING",
  PEST_CONTROL: "PEST_CONTROL",
  HOUSEKEEPING: "HOUSEKEEPING",
  COMMERCIAL_CLEANING: "COMMERCIAL_CLEANING",
  AMC: "HOUSEKEEPING",
};

// Optional package tiers per category (future pricing hooks off these).
export const SERVICE_PACKAGES: Record<string, string[]> = {
  HOME_DEEP_CLEANING: ["Premium", "Platinum", "Diamond"],
  PAINTING: ["Basic", "Premium"],
  HOUSEKEEPING: ["Standard", "Professional"],
};

// Optional combo bundles offered on the booking form (multi-select, no prices).
export const COMBO_SERVICES = [
  "Sofa Cleaning",
  "Mattress Cleaning",
  "Bathroom Cleaning",
  "Kitchen Cleaning",
  "Pest Control",
] as const;

// Payment collection methods.
export const PAYMENT_MODES = ["UPI", "QR", "BANK", "CASH"] as const;
export const PAYMENT_MODE_LABELS: Record<string, string> = {
  UPI: "UPI",
  QR: "QR Scan",
  BANK: "Bank Transfer",
  CASH: "Cash",
};

// Lead-level payment status (booking / manual entry). Job/Payment rows use the
// PaymentStatus enum; "PARTIAL" is derived there.
export const LEAD_PAYMENT_STATUSES = ["PENDING", "PENDING_ADVANCE", "PARTIAL", "PAID"] as const;
export const LEAD_PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PENDING_ADVANCE: "Pending Advance",
  PARTIAL: "Partially Paid",
  PAID: "Paid",
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
  HOME_DEEP_CLEANING: [
    "1 RK",
    "1 BHK",
    "2 BHK",
    "3 BHK",
    "4 BHK",
    "5 BHK",
    "Duplex",
    "Villa",
    "Bungalow",
    "Row House",
    "Individual House",
  ],
  INDIVIDUAL_CLEANING: ["Kitchen", "Bathroom", "Sofa", "Mattress", "Window", "Floor", "Fan", "Fridge", "Balcony"],
  PAINTING: ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Full House", "Office / Commercial", "Exterior", "Waterproofing"],
  PEST_CONTROL: ["Cockroach", "Termite", "Bed Bug", "Rodent", "Mosquito", "General Pest Control"],
  HOUSEKEEPING: ["Daily", "Weekly", "Monthly", "One-time"],
  COMMERCIAL_CLEANING: ["Office", "Shop", "Clinic", "Restaurant", "Showroom", "Warehouse"],
  AMC: ["Residential", "Commercial"],
};

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  WEBSITE: "Website",
  GOOGLE: "Google",
  GMB: "Google Business (GMB)",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  META: "Meta Ads",
};

// Add-on / upsell services a customer can pick on the booking form. No prices
// in the current phase — "Price will be shared after quotation."
export const ADDON_SERVICES = [
  "Sofa",
  "Mattress",
  "Carpet",
  "Window",
  "Curtain",
  "Fridge",
  "Microwave",
  "Fan",
  "Pest Control",
  "Interior Painting",
  "Housekeeping",
  "AMC",
] as const;

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
  JOB_SCHEDULED: "Confirmed Job",
  COMPLETED: "Completed",
};

// Booking time slots — business arrival windows offered on the public booking
// form, the CRM lead form and the Confirm-Booking dialog. Stored as a plain
// string on Lead.timeSlot / Job.scheduledTime, so historical single-time values
// ("10:00 AM") still render fine; only the picker options changed.
export const TIME_SLOTS = [
  "8:00 – 11:00",
  "9:00 – 12:00",
  "10:00 – 1:00",
  "11:00 – 2:00",
  "12:00 – 3:00",
  "1:00 – 4:00",
  "2:00 – 5:00",
  "3:00 – 6:00",
  "Flexible",
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

// Kept as an explicit alias for readability at call sites that mean "the
// customer-facing arrival windows".
export const BOOKING_SLOTS = TIME_SLOTS;

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

// Full status set. The linear workflow is PENDING → ASSIGNED → ON_THE_WAY →
// STARTED → COMPLETED; POSTPONED and CANCELLED are off-flow side states.
export const JOB_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "ON_THE_WAY",
  "STARTED",
  "COMPLETED",
  "POSTPONED",
  "CANCELLED",
  "REACTIVATED",
] as const;

// The happy-path progression a field user steps through.
export const JOB_STATUS_FLOW = ["PENDING", "ASSIGNED", "ON_THE_WAY", "STARTED", "COMPLETED"] as const;

export const JOB_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  ON_THE_WAY: "On the Way",
  STARTED: "Started",
  COMPLETED: "Completed",
  POSTPONED: "Postponed",
  CANCELLED: "Cancelled",
  REACTIVATED: "Reactivated",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  DUE_SOON: "Due Soon",
  OVERDUE: "Overdue",
  PAID: "Paid",
};

// Current expense categories offered in the picker.
export const EXPENSE_CATEGORIES = [
  "HOUSEKEEPING_MATERIAL",
  "FUEL",
  "AUTO_CAB_FARE",
  "EQUIPMENT",
  "BIKE_SERVICE",
  "STAFF_ADVANCE",
  "VENDOR_PAYMENT",
  "MISCELLANEOUS",
] as const;

// Labels — includes the legacy keys (CHEMICALS, BACK_OFFICE) so historical
// expense rows still render a readable name even though the picker no longer
// offers them.
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  HOUSEKEEPING_MATERIAL: "Housekeeping Material",
  FUEL: "Fuel",
  AUTO_CAB_FARE: "Auto / Cab Fare",
  EQUIPMENT: "Equipment",
  BIKE_SERVICE: "Bike Service",
  STAFF_ADVANCE: "Staff Advance",
  VENDOR_PAYMENT: "Vendor Payment",
  MISCELLANEOUS: "Miscellaneous",
  // legacy
  CHEMICALS: "Chemicals (legacy)",
  BACK_OFFICE: "Back Office (legacy)",
};

export const EXPENSE_CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map((value) => ({
  value,
  label: EXPENSE_CATEGORY_LABELS[value],
}));

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Super Admin",
  OPERATIONS: "Operations Manager",
  ACCOUNTS: "Office Assistant",
  SUPERVISOR: "Field Coordinator",
  STAFF: "Field Staff",
};

// Route access matrix. Each role sees the modules relevant to their job;
// Admin always has full access. See src/lib/permissions.ts for the finer
// data-level scoping (own-team-only, today/tomorrow-only, no-salary, etc.)
// layered on top of this section-level matrix.
export const ROLE_NAV_ACCESS: Record<string, string[]> = {
  ADMIN: ["*"],
  // Operations Manager (Shoyab Kazi — 8956567130 — and Francis Monteiro):
  // runs day-to-day operations end to end. Full daily-operations access —
  // leads / CRM, jobs (all of them), quotations, booking forms, staff,
  // vehicles, attendance, AMC, payments, expenses, customers, revenue &
  // operational reports, plus the AI assistant. Every operational WhatsApp
  // action (booking form, quotation, payment link, receipt, job confirmation,
  // reminder) works from this role's own logged-in device.
  // LOCKED (Super Admin only, hidden — no disabled buttons): company &
  // security settings, payment-collection / UPI / QR / bank-account editing,
  // user & role management, permission management, backups, deployments,
  // system configuration, the profit dashboard, staff wages, the WhatsApp
  // send log, trash / audit log / device & security approvals.
  OPERATIONS: [
    "dashboard",
    "leads",
    "jobs",
    "staff",
    "vehicles",
    "attendance",
    "amc",
    "payments",
    "expenses",
    "revenue",
    "customers",
    "reports",
    "assistant",
    "profile",
  ],
  // Office Assistant: front-office CRM only — leads, quotations, follow-ups,
  // customer records, payments (incl. MyBillBook attachments) and reports.
  // NO security, NO settings, NO profit dashboard, NO staff/attendance/vehicles.
  // (No user currently holds this role — Shoyab was promoted to Operations
  // Manager; kept here so the scope is ready if a CRM-only clerk is added.)
  ACCOUNTS: [
    "dashboard",
    "leads",
    "payments",
    "reports",
    "customers",
    "assistant",
    "profile",
  ],
  // Field Coordinator / Team Leader: today's & tomorrow's jobs only (see
  // jobScopeFor "TODAY_TOMORROW"). Call/WhatsApp the customer, open Maps,
  // start/complete the job and upload before/after photos & videos — all from
  // the job detail page. No revenue/profit/expenses/reports/staff/settings.
  SUPERVISOR: ["dashboard", "jobs", "attendance", "profile"],
  // Field Staff (Worker): mobile-only — mark attendance, see assigned jobs,
  // upload before/after photos & videos, open Maps.
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
