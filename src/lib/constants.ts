export const COMPANY = {
  name: "Sahara Cleaning Services",
  website: "www.saharacleaningservices.com",
  phones: ["7083347130", "8956567130"],
  address: "Opp. South Gate, Magarpatta City, Hadapsar, Pune.",
  email: "contact@saharacleaningservices.com",
  gstin: "27DMTPS3584R2ZJ", // real registered GSTIN, 2026-09-22 booking-form master prompt
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
  // Owner-mandated display name (2026-09-21): "Customized Service" — never
  // "Customizer Package" / "Customizer Service" in anything user-facing.
  // The internal key CUSTOMIZER_PACKAGE is unchanged (it's the value already
  // stored on real leads/jobs; renaming the key would need a data migration
  // that isn't required just to change what's displayed).
  CUSTOMIZER_PACKAGE: "Customized Service",
  COMBO_PACKAGE: "Combo Package",
};

export const SERVICE_CATEGORY_TO_LEGACY: Record<string, string> = {
  HOME_DEEP_CLEANING: "HOME_DEEP_CLEANING",
  INDIVIDUAL_CLEANING: "HOUSEKEEPING",
  PAINTING: "INTERIOR_PAINTING",
  PEST_CONTROL: "PEST_CONTROL",
  HOUSEKEEPING: "HOUSEKEEPING",
  COMMERCIAL_CLEANING: "COMMERCIAL_CLEANING",
  AMC: "HOUSEKEEPING",
  CUSTOMIZER_PACKAGE: "HOUSEKEEPING",
  COMBO_PACKAGE: "HOME_DEEP_CLEANING",
};

// The customer-facing categories shown on the public booking page (Service
// Category dropdown + the landing page's Service Category cards/deep link).
// Defined here — NOT inside the "use client" PublicBookingForm — because the
// Server Component booking page (src/app/book/page.tsx) reads this array
// during SSR; importing a plain constant from a "use client" module into a
// Server Component resolves to a client-reference proxy on the server (not
// the real array), which crashed production with
// "TypeError: CATEGORIES.some is not a function". Both the client form and
// the server page now import this same array from here.
export const CATEGORIES: { value: string; label: string }[] = [
  { value: "HOME_DEEP_CLEANING", label: "Home Cleaning" },
  { value: "COMMERCIAL_CLEANING", label: "Commercial Cleaning" },
  { value: "PAINTING", label: "Interior Painting" },
  { value: "PEST_CONTROL", label: "Pest Control" },
  { value: "CUSTOMIZER_PACKAGE", label: "Customized Service" },
  { value: "COMBO_PACKAGE", label: "Combo Package" },
];

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

// Master Prompt v3.1 Phase 2 — customer-facing service dropdowns. "Select
// Service" (this catalog) is distinct from "Property Type" (PROPERTY_TYPES).
export const SERVICE_CATALOG: Record<string, string[]> = {
  HOME_DEEP_CLEANING: [
    "Full Home Cleaning",
    "Sofa Cleaning",
    "Mattress Cleaning",
    "Carpet Cleaning",
    "Window Cleaning",
    "Bathroom Cleaning",
    "Kitchen Deep Cleaning",
    "Curtain Cleaning",
  ],
  // Master Prompt overnight batch — added "Curtain" as the 9th item so every
  // Individual Cleaning service supports its own quantity (Kitchen, Bathroom,
  // Sofa, Mattress, Window, Curtain, Fan, Fridge, Balcony).
  INDIVIDUAL_CLEANING: ["Kitchen", "Bathroom", "Sofa", "Mattress", "Window", "Curtain", "Fan", "Fridge", "Balcony"],
  PAINTING: [
    "Oil Bound",
    "Premium Emulsion",
    "Royal Emulsion",
    "Royal Lustre",
    "Texture Painting",
  ],
  PEST_CONTROL: [
    "Cockroach",
    "Bed Bugs",
    "Rodent",
    "Termite",
    "Mosquito",
    "General Pest Control",
  ],
  HOUSEKEEPING: ["Daily", "Weekly", "Monthly", "One-time"],
  COMMERCIAL_CLEANING: [
    "Office Cleaning",
    "Shop Cleaning",
    "Warehouse Cleaning",
    "Hospital Cleaning",
    "Factory Cleaning",
    "Restaurant Cleaning",
    "School Cleaning",
  ],
  AMC: ["Residential", "Commercial"],
  // Master Prompt v3.3 — category-driven customized & combo workflows.
  CUSTOMIZER_PACKAGE: [
    "Sofa Cleaning",
    "Carpet Cleaning",
    "Window Cleaning",
    "Mattress Cleaning",
    "Bathroom Cleaning",
    "Balcony Cleaning",
    "Kitchen Cleaning",
    "Chimney Cleaning",
    "Refrigerator Cleaning",
    "Fan Cleaning",
    "Floor Cleaning",
  ],
  COMBO_PACKAGE: [
    "Home Cleaning + Sofa Shampooing",
    "Home Cleaning + Pest Control",
    "Kitchen + Bathroom Deep Clean",
    "Sofa + Carpet + Mattress",
    "Full Home + Pest Control + Sofa",
    "Move-in / Move-out Combo",
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// Public booking form ONLY (2026-09-22 booking-form master prompt) — kept
// deliberately separate from SERVICE_CATALOG above, which the internal CRM's
// ServiceCategoryPicker (New/Edit Lead form) also reads for Home Cleaning/
// Painting. Changing SERVICE_CATALOG itself would have altered the internal
// CRM's dropdowns too, which this prompt explicitly must not touch — these
// two constants let the public page show a different, customer-facing
// service-type list without moving the CRM's own list at all.
// ─────────────────────────────────────────────────────────────────────────
export const PUBLIC_HOME_CLEANING_SERVICE_TYPES = [
  "Full Home Cleaning",
  "Move-In / Move-Out Cleaning",
  "Post-Interior Deep Cleaning",
  "Post-Construction Deep Cleaning",
] as const;

// Package tier shown only when the customer picks "Full Home Cleaning"
// above — kept separate from SERVICE_PACKAGES (CRM-only, Premium/Platinum/
// Diamond) since the owner's approved public tier names/count differ
// (Essential/Premium/Platinum). No pricing is attached or displayed
// publicly (see PUBLIC_PRICING_VISIBILITY note near the payment section).
export const HOME_CLEANING_PACKAGES = ["Essential", "Premium", "Platinum"] as const;

// Public-facing paint type names — kept separate from SERVICE_CATALOG.PAINTING
// (CRM-only) for the same reason as above; the CRM's own paint-type list and
// PAINT_TYPE_RATE_PER_SQFT rate keys are untouched.
export const PUBLIC_PAINT_TYPES = [
  "Oil Bound Distemper",
  "Tractor Emulsion",
  "Premium Emulsion",
  "Royal Luster",
  "Royal Oil Luster",
  "Royal Mat Finish",
  "Royal Aspira",
] as const;

export const PAINTING_REQUIREMENT_OPTIONS = ["New Painting", "Repainting"] as const;

// Helper text shown under the "Select Service" dropdown for services that
// carry a minimum quantity or an indicative starting price.
export const SERVICE_RULES: Record<string, string> = {
  "Sofa Cleaning": "Minimum 5 seats",
  "Mattress Cleaning": "Minimum 2 mattresses",
  "Carpet Cleaning": "Minimum 2 carpets",
  "Window Cleaning": "₹250 / window · minimum 5 windows",
  "Bathroom Cleaning": "₹1000 · minimum 2 bathrooms",
  "Kitchen Deep Cleaning": "₹1600 onwards",
  "Curtain Cleaning": "₹199 / pair · minimum 2 pairs",
};

// Property type — asked once, options depend on whether the category is a
// commercial one. Stored on Lead.propertyType / Job.propertyType.
export const HOME_PROPERTY_TYPES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK", "Villa", "Bungalow", "Row House"] as const;
export const COMMERCIAL_PROPERTY_TYPES = ["Office", "Shop", "Showroom", "Warehouse", "Factory", "Hospital / Clinic", "Restaurant", "Society / Complex"] as const;
export const COMMERCIAL_CATEGORIES = ["COMMERCIAL_CLEANING"];
export function propertyTypesFor(category: string): readonly string[] {
  return COMMERCIAL_CATEGORIES.includes(category) ? COMMERCIAL_PROPERTY_TYPES : HOME_PROPERTY_TYPES;
}

// Add-on services with indicative pricing shown on the booking form
// (matches the approved booking-page mockup).
export const ADDON_SERVICE_PRICES: { name: string; price: string }[] = [
  { name: "Sofa Shampooing", price: "₹499 / seat" },
  { name: "Mattress Cleaning", price: "₹399 / mattress" },
  { name: "Refrigerator Cleaning", price: "₹499" },
  { name: "Pest Control", price: "₹899 onwards" },
];

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

// ─────────────────────────────────────────────────────────────────────────
// Booking Form V2 — dynamic service sub-fields & indicative live pricing.
//
// These figures power the "Estimated from your selections" suggestion shown
// while the customer fills the form (see PublicBookingForm). They are
// ESTIMATE-ONLY: the number is offered as a one-click suggestion into the
// existing "Estimated ₹" field, never submitted on its own or treated as a
// final price. The office team always confirms the real amount. Tune these
// numbers any time — they don't affect quotations, jobs or existing pricing
// logic elsewhere in the CRM.
// ─────────────────────────────────────────────────────────────────────────

export const SOFA_SEATER_OPTIONS = ["1 Seater", "2 Seater", "3 Seater", "5 Seater", "6 Seater", "7 Seater", "L Shape"] as const;
export const SOFA_SEATER_PRICES: Record<string, number> = {
  "1 Seater": 499,
  "2 Seater": 899,
  "3 Seater": 1299,
  "5 Seater": 1999,
  "6 Seater": 2399,
  "7 Seater": 2799,
  "L Shape": 2499,
};

export const MATTRESS_SIZE_OPTIONS = ["Single", "Double"] as const;
export const MATTRESS_UNIT_PRICE: Record<string, number> = { Single: 399, Double: 599 };

// Per-unit indicative price for the simple "quantity" style Home Cleaning
// sub-services (Bathroom / Kitchen / Carpet / Window / Curtain Cleaning).
export const HOME_SERVICE_UNIT_PRICE: Record<string, number> = {
  "Bathroom Cleaning": 500,
  "Kitchen Deep Cleaning": 1600,
  "Carpet Cleaning": 299,
  "Window Cleaning": 250,
  "Curtain Cleaning": 199, // per pair
};

// Customized Service (manual CRM lead entry, internal key CUSTOMIZER_PACKAGE
// unchanged — see SERVICE_CATEGORY_LABELS) — per-item quantity-based unit
// rates. These are DEFAULT pre-fills only, never a locked/read-only rate —
// staff can always overwrite the Unit Price for any item (owner mandate
// 2026-09-21: "Remove fixed Unit Price. Make Unit Price editable."). Every
// default here reuses a rate that's already configured elsewhere for the
// same real service, never an invented number:
//  - Carpet/Window/Bathroom match Home Deep Cleaning's existing per-unit
//    price (HOME_SERVICE_UNIT_PRICE).
//  - Refrigerator matches the existing ADDON_SERVICE_PRICES entry.
//  - Sofa Cleaning defaults to the middle of the owner-defined per-seat
//    tiers (200/250/300 — see CUSTOMIZED_SOFA_RATE_OPTIONS), distinct from
//    the customer-facing ₹499/seat "Sofa Shampooing" Booking Form upsell
//    (ADDON_SERVICE_PRICES), which stays untouched.
// Mattress Cleaning is pre-filled by size instead (MATTRESS_UNIT_PRICE —
// Single vs Double genuinely have different real rates) but is likewise
// editable, not locked.
// Every other Customized Service item in SERVICE_CATALOG (Balcony/Kitchen/
// Chimney/Fan/Floor Cleaning) has no default yet — the field simply starts
// blank and staff enter the real quoted unit price (see ServiceQuantityFields).
export const CUSTOMIZER_FIXED_UNIT_PRICE: Record<string, number> = {
  "Carpet Cleaning": 299,
  "Window Cleaning": 250,
  "Bathroom Cleaning": 500,
  "Refrigerator Cleaning": 499,
  "Sofa Cleaning": 250,
};

// Display-only unit noun for every Customized Service item in
// SERVICE_CATALOG.CUSTOMIZER_PACKAGE, so the Unit Price field always shows
// the correct unit even for the items that have no default rate yet and
// stay manual entry (e.g. "₹ / balcony" instead of a bare "₹"). This is a
// display label only — it does not imply a rate is configured; see
// CUSTOMIZER_FIXED_UNIT_PRICE for which items get a default pre-fill.
export const CUSTOMIZER_UNIT_LABEL: Record<string, string> = {
  "Sofa Cleaning": "seat",
  "Carpet Cleaning": "carpet",
  "Window Cleaning": "window",
  "Bathroom Cleaning": "bathroom",
  "Balcony Cleaning": "balcony",
  "Kitchen Cleaning": "kitchen",
  "Chimney Cleaning": "chimney",
  "Refrigerator Cleaning": "fridge",
  "Fan Cleaning": "fan",
  "Floor Cleaning": "sq ft",
  "Mattress Cleaning": "mattress",
};

// Manual CRM Sofa Cleaning quick-fill rate chips for Customized Service —
// owner-defined (2026-09-21), deliberately separate from the customer-facing
// ₹499/seat "Sofa Shampooing" Booking Form upsell (ADDON_SERVICE_PRICES),
// which must stay exactly as configured. Shown as one-click shortcuts next
// to the editable Unit Price input — not a locked selector — see
// ServiceQuantityFields.
export const CUSTOMIZED_SOFA_RATE_OPTIONS = [200, 250, 300] as const;

export const PAINT_TYPE_RATE_PER_SQFT: Record<string, number> = {
  "Oil Bound": 14,
  "Premium Emulsion": 18,
  "Royal Emulsion": 22,
  "Royal Lustre": 26,
  "Texture Painting": 45,
};
export const PUTTY_RATE_PER_SQFT = 12;

export const PEST_PROPERTY_SIZE_OPTIONS = ["1 BHK", "2 BHK", "3 BHK", "4 BHK+", "Commercial / Shop"] as const;
export const PEST_PROPERTY_SIZE_PRICES: Record<string, number> = {
  "1 BHK": 899,
  "2 BHK": 1299,
  "3 BHK": 1699,
  "4 BHK+": 2199,
  "Commercial / Shop": 1999,
};

export const HOUSEKEEPING_SHIFT_HOURS = ["4 Hours", "6 Hours", "8 Hours", "12 Hours"] as const;
export const HOUSEKEEPING_HOURLY_RATE = 60; // ₹ per staff, per hour — indicative

// Customer-facing "How did you hear about Sahara?" — a distinct, always
// optional field from the internal LEAD_SOURCE_* enum above (which tracks
// ?source= links / GMB / Meta ad attribution). This one is the customer's
// own free choice, saved into the lead's notes for owner reporting, and never
// overwrites the tracked `source` field on Lead.
export const HEAR_ABOUT_US_OPTIONS = [
  "Google Search",
  "Google Maps",
  "Instagram",
  "Facebook",
  "WhatsApp",
  "Friend / Referral",
  "Existing Customer",
  "Other",
] as const;

// Smart Calendar — a configurable daily job capacity used to compute a real
// "X slots left" estimate for the selected date (never a fabricated number).
// Raise or lower this to match how many jobs the team can realistically take
// on in a day.
export const DAILY_BOOKING_CAPACITY = 8;

// Slot-level availability (src/server/actions/slot-availability.ts): how many
// crews work in parallel (teams 1–4), how long one booking occupies a crew
// (home deep cleaning is documented at 7–8 hours), and dates the office has
// blocked (holidays etc., "YYYY-MM-DD").
export const BOOKING_TEAM_COUNT = 4;
export const BOOKING_JOB_DURATION_HOURS = 8;
export const BLOCKED_BOOKING_DATES: readonly string[] = [];

export const LEAD_STAGES = [
  "NEW",
  "INTERESTED",
  "SITE_VISIT",
  "QUOTATION",
  "CONFIRMED",
  "JOB_SCHEDULED",
  "CANCELLED",
  "COMPLETED",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  INTERESTED: "Interested",
  SITE_VISIT: "Site Visit",
  QUOTATION: "Quotation",
  NEGOTIATION: "Negotiation", // legacy — no longer selectable, kept so any historical record still renders a label
  CONFIRMED: "Confirmed",
  JOB_SCHEDULED: "Pending Job",
  CANCELLED: "Cancelled",
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
  ACCOUNTS: "Accounts & Operations Editor",
  SUPERVISOR: "Field Coordinator",
  STAFF: "Field Staff",
};

// Route access matrix. Each role sees the modules relevant to their job;
// Admin always has full access. See src/lib/permissions.ts for the finer
// data-level scoping (own-team-only, today/tomorrow-only, no-salary, etc.)
// layered on top of this section-level matrix.
export const ROLE_NAV_ACCESS: Record<string, string[]> = {
  ADMIN: ["*"],
    // Operations role — field-only policy, owner decision 2026-09-25 (Francis
    // is now the sole OPERATIONS user, reassigned from SUPERVISOR): Dashboard
    // (today/tomorrow only, see isFieldRestricted in dashboard.ts/page.tsx),
    // Jobs (incl. Team Dispatch — shares the "jobs" section, customer phone
    // hidden — see canSeeCustomerContact), Staff, Vehicles, Attendance (view
    // + operate the office clock only), AMC, the filtered Housekeeping/Pest
    // Control/Interior Painting job views, Gallery (via "admin"), Trash
    // (restore only). Deliberately excluded (previously granted when Shoyab
    // held this role as Operations Manager, now removed as full customer/
    // financial data exposure Francis must never have): Leads/CRM,
    // Customers, Quotations, Invoices, Payments, Expenses, Reports, AI
    // Assistant, global search/export (see canSearchGlobally/
    // canExportCustomers), Revenue Dashboard, Profit, staff salary/wage
    // figures, User Management, Audit Log, Device/Security Approvals,
    // WhatsApp Log, system settings.
    OPERATIONS: [
          "dashboard",
          "jobs",
          "staff",
          "vehicles",
          "attendance",
          "amc",
          "service-housekeeping",
          "service-pest-control",
          "service-interior-painting",
          "admin",
          "trash",
          "profile",
        ],
    // Accounts role — currently Shoaib (Accounts & Operations Editor).
    // Same working CRM as Super Admin except owner-only security/account
    // settings: Dashboard, Leads/CRM, Jobs (incl. Team Dispatch), Staff,
    // Vehicles, Attendance, AMC Contracts, Payments, Expenses, the filtered
    // Housekeeping/Pest Control/Interior Painting job views, Revenue
    // Dashboard, Customers, Reports, AI Assistant, Gallery, Trash (restore),
    // WhatsApp Log (Message Log — kept visible to Accounts per the owner's
    // explicit decision on requirement #15; see permissions.ts
    // canViewWhatsAppLog's page-level comment history).
    // Owner-only sections (Profit, User Management, Audit Log,
    // Device/Security Approvals) remain hidden.
    ACCOUNTS: [
          "dashboard",
          "leads",
          "jobs",
          "staff",
          "vehicles",
          "attendance",
          "amc",
          "payments",
          "expenses",
          "quotations",
          "invoices",
          "service-housekeeping",
          "service-pest-control",
          "service-interior-painting",
          "revenue",
          "customers",
          "reports",
          "assistant",
          "admin",
          "whatsapp-log",
          "trash",
          "profile",
        ],
  // Field Coordinator role — SUPERSEDED 2026-09-21 (owner's final Francis
  // policy, explicitly overriding the "identical to Operations" version
  // that stood earlier the same day — see the "IMPORTANT POLICY OVERRIDE"
  // note under requirement #2 in SAHARA_OS_MASTER_REQUIREMENTS.md for the
  // full history). Francis's access is now deliberately narrower than
  // Shoyab's (OPERATIONS, unchanged) — exactly these 7 sections plus his
  // own profile: Dashboard, Leads/CRM, Jobs (incl. Team Dispatch — shares
  // the "jobs" section), Staff, Vehicles, Attendance. No AMC, Payments,
  // Expenses, Housekeeping/Pest Control/Interior Painting service views,
  // Customers (the standalone database), Reports, AI Assistant, Gallery,
  // or Trash. Within Jobs/Leads, edit access is further time-scoped to
  // today/tomorrow (see canAccessJob in server/jobs.ts and the equivalent
  // Lead scoping in server/leads.ts) and Staff/Attendance further hide
  // salary/wage/bank/private-document data (see canViewSalary and the
  // staff detail page) — this list only controls which top-level sections
  // exist at all, not what's visible/editable within them.
  SUPERVISOR: ["dashboard", "leads", "jobs", "staff", "vehicles", "attendance", "profile"],
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
  WEEKLY_OFF: "Weekly Off",
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
