// Customer category tag (owner, 17 Oct 2026). Stored in Customer.contactType (TEXT) — the existing
// field, so no schema change. The six owner categories come first; ARCHITECT and SOCIETY are older
// values kept readable so no existing record is lost or silently re-labelled.
export const CATEGORY_OPTIONS = ["CUSTOMER", "BROKER", "INTERIOR_DESIGNER", "VENDOR", "AMC_CLIENT", "CORPORATE"] as const;
export const LEGACY_CATEGORIES = ["ARCHITECT", "SOCIETY"] as const;
export const CONTACT_TYPES = [...CATEGORY_OPTIONS, ...LEGACY_CATEGORIES] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];
export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  CUSTOMER: "Direct Customer",
  BROKER: "Broker",
  INTERIOR_DESIGNER: "Interior Designer",
  VENDOR: "Vendor",
  AMC_CLIENT: "AMC Client",
  CORPORATE: "Commercial / B2B Partner",
  ARCHITECT: "Architect",
  SOCIETY: "Society / Facility",
};
export const isContactType = (v: unknown): v is ContactType => typeof v === "string" && (CONTACT_TYPES as readonly string[]).includes(v);
export const categoryLabel = (v: string | null | undefined) => (isContactType(v) ? CONTACT_TYPE_LABEL[v] : CONTACT_TYPE_LABEL.CUSTOMER);
/** Picker options: the six categories, plus the record's current legacy value if it has one. */
export const categoryChoices = (current?: string | null): ContactType[] =>
  [...CATEGORY_OPTIONS, ...LEGACY_CATEGORIES.filter((l) => l === current)];
