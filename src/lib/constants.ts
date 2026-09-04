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
    "profile",
  ],
  ACCOUNTS: [
    "dashboard",
    "payments",
    "expenses",
    "profit",
    "reports",
    "assistant",
    "profile",
  ],
  SUPERVISOR: ["dashboard", "jobs", "staff", "leads", "assistant", "profile"],
  STAFF: ["dashboard", "jobs", "profile"],
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
