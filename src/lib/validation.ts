import { z } from "zod";

export const teamNumberSchema = z
  .union([z.literal(""), z.coerce.number().int().min(1).max(4)])
  .optional();

// Time slots are free-form arrival-window labels (see TIME_SLOTS in constants).
// Kept as a loose string so historical single-time values and the new range
// windows both validate.
export const timeSlotSchema = z.string().max(40).optional().or(z.literal(""));

// Strong password policy — min 12 chars with upper, lower, digit and special.
export const strongPasswordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[0-9]/, "Add a number")
  .regex(/[^A-Za-z0-9]/, "Add a special character");

export const LEAD_SOURCES = [
  "CALL",
  "WHATSAPP",
  "WEBSITE",
  "GOOGLE",
  "GMB",
  "FACEBOOK",
  "INSTAGRAM",
  "META",
] as const;

export const leadSchema = z.object({
  name: z.string().min(2, "Name is required"),
  mobile: z.string().min(10, "Enter a valid 10-digit mobile number").max(15),
  alternateMobile: z.string().optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  area: z.string().optional().or(z.literal("")),
  pinCode: z
    .string()
    .regex(/^\d{6}$/, "Enter a 6-digit PIN code")
    .optional()
    .or(z.literal("")),
  timeSlot: timeSlotSchema,
  addOnServices: z.array(z.string()).optional(),
  service: z.enum([
    "HOME_DEEP_CLEANING",
    "COMMERCIAL_CLEANING",
    "HOUSEKEEPING",
    "PEST_CONTROL",
    "INTERIOR_PAINTING",
  ]),
  source: z.enum(LEAD_SOURCES),
  quoteAmount: z.coerce.number().min(0).optional(),
  followUpDate: z.string().optional().or(z.literal("")),
  serviceDate: z.string().optional().or(z.literal("")),
  teamNumber: teamNumberSchema,
  assignedStaffId: z.string().optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  serviceCategory: z.string().optional().or(z.literal("")),
  serviceVariant: z.string().optional().or(z.literal("")),
  mapLink: z.string().optional().or(z.literal("")),
});

export type LeadFormValues = z.infer<typeof leadSchema>;

export const jobSchema = z.object({
  customerName: z.string().min(2),
  customerMobile: z.string().min(10),
  alternateMobile: z.string().optional().or(z.literal("")),
  address: z.string().min(2),
  area: z.string().optional().or(z.literal("")),
  pinCode: z.string().regex(/^\d{6}$/, "Enter a 6-digit PIN code").optional().or(z.literal("")),
  service: z.enum([
    "HOME_DEEP_CLEANING",
    "COMMERCIAL_CLEANING",
    "HOUSEKEEPING",
    "PEST_CONTROL",
    "INTERIOR_PAINTING",
  ]),
  serviceVariant: z.string().optional().or(z.literal("")),
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().min(1),
  teamNumber: teamNumberSchema,
  supervisorId: z.string().optional().or(z.literal("")),
  staffIds: z.array(z.string()).optional(),
  jobValue: z.coerce.number().min(3999, "Minimum job value is ₹3,999"),
  notes: z.string().optional().or(z.literal("")),
  leadId: z.string().optional().or(z.literal("")),
});

export type JobFormValues = z.infer<typeof jobSchema>;

export const staffSchema = z.object({
  name: z.string().min(2),
  mobile: z.string().min(10),
  alternateMobile: z.string().optional().or(z.literal("")),
  designation: z.string().min(2),
  salaryType: z.enum(["DAILY", "MONTHLY"]),
  dailyWage: z.coerce.number().optional(),
  monthlySalary: z.coerce.number().optional(),
  joiningDate: z.string().optional().or(z.literal("")),
  reference: z.string().optional().or(z.literal("")),
  bankAccount: z.string().optional().or(z.literal("")),
  bankIfsc: z.string().optional().or(z.literal("")),
  gpayNumber: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type StaffFormValues = z.infer<typeof staffSchema>;

export const expenseSchema = z.object({
  // Accepts current + legacy categories so historical rows still edit cleanly.
  category: z.enum([
    "HOUSEKEEPING_MATERIAL",
    "FUEL",
    "AUTO_CAB_FARE",
    "EQUIPMENT",
    "BIKE_SERVICE",
    "STAFF_ADVANCE",
    "VENDOR_PAYMENT",
    "MISCELLANEOUS",
    "CHEMICALS",
    "BACK_OFFICE",
  ]),
  description: z.string().min(2),
  amount: z.coerce.number().min(1),
  date: z.string().min(1),
  paidTo: z.string().optional().or(z.literal("")),
  staffId: z.string().optional().or(z.literal("")),
  jobId: z.string().optional().or(z.literal("")),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

export const paymentSchema = z.object({
  clientName: z.string().min(2),
  clientMobile: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().min(1),
  dueDate: z.string().min(1),
  jobId: z.string().optional().or(z.literal("")),
  mybillbookInvoiceNo: z.string().optional().or(z.literal("")),
  invoiceAttachmentUrl: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

export const companySettingsSchema = z.object({
  name: z.string().min(2, "Company name is required"),
  phone: z.string().min(6, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email"),
  address: z.string().min(4, "Address is required"),
  website: z.string().optional().or(z.literal("")),
  logoUrl: z.string().optional().or(z.literal("")),
  googleReviewUrl: z.string().optional().or(z.literal("")),
});

export type CompanySettingsFormValues = z.infer<typeof companySettingsSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

// ── Phase 1: Smart Enquiry Hub ─────────────────────────────────────────

export const quickCaptureSchema = z.object({
  mobile: z.string().min(10, "Enter a valid 10-digit mobile number").max(15),
  name: z.string().min(2, "Name is required"),
  area: z.string().optional().or(z.literal("")),
  pinCode: z.string().regex(/^\d{6}$/, "Enter a 6-digit PIN code").optional().or(z.literal("")),
  service: z.enum([
    "HOME_DEEP_CLEANING",
    "COMMERCIAL_CLEANING",
    "HOUSEKEEPING",
    "PEST_CONTROL",
    "INTERIOR_PAINTING",
  ]),
});

export type QuickCaptureFormValues = z.infer<typeof quickCaptureSchema>;

export const followUpSchema = z.object({
  dueDate: z.string().min(1, "Pick a date"),
  dueTime: z.string().optional().or(z.literal("")),
  type: z.enum(["CALL", "WHATSAPP", "SITE_VISIT", "PAYMENT", "CUSTOM"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  notes: z.string().optional().or(z.literal("")),
});

export type FollowUpFormValues = z.infer<typeof followUpSchema>;

export const confirmBookingSchema = z.object({
  serviceDate: z.string().min(1, "Pick a service date"),
  timeSlot: z.string().min(1, "Pick a slot").max(40),
  teamNumber: teamNumberSchema,
  supervisorId: z.string().optional().or(z.literal("")),
});

export type ConfirmBookingFormValues = z.infer<typeof confirmBookingSchema>;

export const callLogSchema = z.object({
  outcome: z.enum(["NO_ANSWER", "BUSY", "INTERESTED", "CALL_BACK", "CONFIRMED", "WRONG_NUMBER"]),
  notes: z.string().optional().or(z.literal("")),
});

export type CallLogFormValues = z.infer<typeof callLogSchema>;

export const timelineNoteSchema = z.object({
  body: z.string().min(1, "Write something first").max(4000),
});

export const amcSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerMobile: z.string().min(10, "Enter a valid mobile number"),
  address: z.string().optional().or(z.literal("")),
  area: z.string().optional().or(z.literal("")),
  category: z.enum(["RESIDENTIAL", "COMMERCIAL"]),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"]),
  serviceCategory: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().min(0, "Enter a valid amount"),
  startDate: z.string().min(1, "Pick a start date"),
  serviceReminderDate: z.string().optional().or(z.literal("")),
  contractExpiryDate: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  leadId: z.string().optional().or(z.literal("")),
});

export type AmcFormValues = z.infer<typeof amcSchema>;
