import { z } from "zod";

export const leadSchema = z.object({
  name: z.string().min(2, "Name is required"),
  mobile: z.string().min(10, "Enter a valid 10-digit mobile number").max(15),
  whatsapp: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  area: z.string().min(2, "Area is required"),
  service: z.enum([
    "HOME_DEEP_CLEANING",
    "COMMERCIAL_CLEANING",
    "HOUSEKEEPING",
    "PEST_CONTROL",
    "INTERIOR_PAINTING",
  ]),
  source: z.enum(["WHATSAPP", "CALL", "WEBSITE", "GOOGLE"]),
  quoteAmount: z.coerce.number().min(0).optional(),
  followUpDate: z.string().optional().or(z.literal("")),
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
  address: z.string().min(2),
  area: z.string().min(2),
  service: z.enum([
    "HOME_DEEP_CLEANING",
    "COMMERCIAL_CLEANING",
    "HOUSEKEEPING",
    "PEST_CONTROL",
    "INTERIOR_PAINTING",
  ]),
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().min(1),
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
  designation: z.string().min(2),
  salaryType: z.enum(["DAILY", "MONTHLY"]),
  dailyWage: z.coerce.number().optional(),
  monthlySalary: z.coerce.number().optional(),
  notes: z.string().optional().or(z.literal("")),
});

export type StaffFormValues = z.infer<typeof staffSchema>;

export const expenseSchema = z.object({
  category: z.enum(["CHEMICALS", "FUEL", "EQUIPMENT", "STAFF_ADVANCE", "MISCELLANEOUS"]),
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
  notes: z.string().optional().or(z.literal("")),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

export const companySettingsSchema = z.object({
  name: z.string().min(2, "Company name is required"),
  phone: z.string().min(6, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email"),
  address: z.string().min(4, "Address is required"),
  logoUrl: z.string().optional().or(z.literal("")),
  googleReviewUrl: z.string().optional().or(z.literal("")),
});

export type CompanySettingsFormValues = z.infer<typeof companySettingsSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
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
  area: z.string().min(2, "Area is required"),
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
  timeSlot: z.enum([
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
  ]),
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
  notes: z.string().optional().or(z.literal("")),
  leadId: z.string().optional().or(z.literal("")),
});

export type AmcFormValues = z.infer<typeof amcSchema>;
