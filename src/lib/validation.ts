import { z } from "zod";

export const teamNumberSchema = z
  .union([z.literal(""), z.coerce.number().int().min(1).max(4)])
  .optional();

// Time slots are free-form arrival-window labels (see TIME_SLOTS in constants).
// Kept as a loose string so historical single-time values and the new range
// windows both validate.
export const timeSlotSchema = z.string().max(40).optional().or(z.literal(""));

// Password policy. Kept deliberately light — office users may choose a simple
// password. Security is enforced by Super-Admin device approval + OTP on
// password change, not by complexity rules.
export const strongPasswordSchema = z
  .string()
  .min(6, "Use at least 6 characters")
  .max(72, "Password is too long");

// Staff App PIN (owner rule 2026-10-04: simple PINs for field staff). A
// 4–6 digit PIN, or any password of 6+ characters. Obvious PINs (all one
// digit, 1234…) are refused since staff sign in with their public mobile.
const WEAK_PINS = new Set(["1234", "12345", "123456", "4321", "654321", "1212", "123123"]);
export const staffPinSchema = z
  .string()
  .max(72, "Too long")
  .refine((v) => (/^\d+$/.test(v) ? v.length >= 4 && v.length <= 6 : v.length >= 6), "Use a 4–6 digit PIN")
  .refine((v) => !(/^(\d)\1+$/.test(v) || WEAK_PINS.has(v)), "This PIN is too easy to guess — choose another");

export const staffChangePinSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current PIN"),
    newPassword: staffPinSchema,
    confirmPassword: z.string().min(1, "Enter the new PIN again"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "PINs do not match", path: ["confirmPassword"] });

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
  advanceAmount: z.coerce.number().min(0).optional(),
  paymentMode: z.enum(["UPI", "QR", "BANK", "CASH"]).optional().or(z.literal("")),
  paymentStatus: z.enum(["PENDING", "PENDING_ADVANCE", "PARTIAL", "PAID"]).optional().or(z.literal("")),
  followUpDate: z.string().optional().or(z.literal("")),
  serviceDate: z.string().optional().or(z.literal("")),
  teamNumber: teamNumberSchema,
  assignedStaffId: z.string().optional().or(z.literal("")),
  assignedStaffIds: z.array(z.string()).optional(),
  assignedToId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  serviceCategory: z.string().optional().or(z.literal("")),
  serviceVariant: z.string().optional().or(z.literal("")),
  packageName: z.string().optional().or(z.literal("")),
  comboServices: z.array(z.string()).optional(),
  mapLink: z.string().optional().or(z.literal("")),
  // Marketing attribution for leads entered by hand (set once, on create).
  acquisitionChannel: z.string().max(60).optional().or(z.literal("")),
  acquisitionCampaign: z.string().max(120).optional().or(z.literal("")),
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
  packageName: z.string().optional().or(z.literal("")),
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().min(1),
  teamNumber: teamNumberSchema,
  supervisorId: z.string().optional().or(z.literal("")),
  staffIds: z.array(z.string()).optional(),
  jobValue: z.coerce.number().min(0, "Job value can't be negative"), // no minimum — pricing master is the source of truth
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
    "SALARY",
    "OFFICE_RENT",
    "MACHINE_REPAIR",
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

export const reviewSchema = z.object({
  customerMobile: z.string().min(10, "Enter a valid mobile number"),
  customerName: z.string().optional().or(z.literal("")),
  rating: z.coerce.number().min(1).max(5),
  comment: z.string().optional().or(z.literal("")),
});

export type ReviewFormValues = z.infer<typeof reviewSchema>;

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
  googleRating: z.string().optional().or(z.literal("")),
  googleReviewCount: z.string().optional().or(z.literal("")),
  happyCustomers: z.string().optional().or(z.literal("")),
  featuredReviews: z.string().optional().or(z.literal("")),
  upiId: z.string().optional().or(z.literal("")),
  upiQrUrl: z.string().optional().or(z.literal("")),
  bankName: z.string().optional().or(z.literal("")),
  bankAccountName: z.string().optional().or(z.literal("")),
  bankAccountNumber: z.string().optional().or(z.literal("")),
  bankIfsc: z.string().optional().or(z.literal("")),
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

// Self-service "Forgot Password" — for a user who is locked out and can't
// use the Change Password dialog (which requires signing in first). Same
// owner-OTP confirmation as changePasswordSchema, minus currentPassword.
export const forgotPasswordSchema = z
  .object({
        mobile: z.string().min(10, "Enter a valid 10-digit mobile number").max(15),
        newPassword: strongPasswordSchema,
        confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
  });

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

// Forgot Login ID — the only identifier we ask for is the account's full
// name; the account lookup and any real mobile/email are never sent back to
// the browser (see requestLoginIdRecovery), only relayed by the Super Admin.
export const forgotLoginIdSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name as registered"),
});

export type ForgotLoginIdFormValues = z.infer<typeof forgotLoginIdSchema>;

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

// ── Admin User Management ──────────────────────────────────────────────

export const USER_ROLES = ["ADMIN", "OPERATIONS", "ACCOUNTS", "SUPERVISOR", "STAFF"] as const;

export const createUserSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z
    .string()
    .regex(/^\d{10}$/, "Enter a 10-digit mobile number")
    .optional()
    .or(z.literal("")),
  role: z.enum(USER_ROLES),
  password: strongPasswordSchema,
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
