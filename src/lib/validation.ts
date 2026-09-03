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
