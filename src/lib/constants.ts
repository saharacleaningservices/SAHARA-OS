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
  "SITE_VISIT",
  "QUOTE_SENT",
  "NEGOTIATION",
  "CONFIRMED",
  "JOB_SCHEDULED",
  "COMPLETED",
  "PAID",
] as const;

export const LEAD_STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  SITE_VISIT: "Site Visit",
  QUOTE_SENT: "Quote Sent",
  NEGOTIATION: "Negotiation",
  CONFIRMED: "Confirmed",
  JOB_SCHEDULED: "Job Scheduled",
  COMPLETED: "Completed",
  PAID: "Paid",
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
  OPERATIONS: "Operations",
  ACCOUNTS: "Accounts",
  SUPERVISOR: "Supervisor",
  STAFF: "Staff",
};

// Route access matrix. Each role sees the modules relevant to their job;
// Admin always has full access.
export const ROLE_NAV_ACCESS: Record<string, string[]> = {
  ADMIN: ["*"],
  OPERATIONS: [
    "dashboard",
    "leads",
    "jobs",
    "staff",
    "reports",
    "assistant",
  ],
  ACCOUNTS: [
    "dashboard",
    "payments",
    "expenses",
    "profit",
    "reports",
    "assistant",
  ],
  SUPERVISOR: ["dashboard", "jobs", "staff", "leads", "assistant"],
  STAFF: ["dashboard", "jobs"],
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
