export const COMPANY_DOC_CATEGORIES = [
  "PROFILE_PDF",
  "PPT",
  "GST",
  "SHOP_ACT",
  "MSME",
  "CERTIFICATE",
  "BROCHURE",
  "OTHER",
] as const;

export const COMPANY_DOC_LABELS: Record<string, string> = {
  PROFILE_PDF: "Company Profile PDF",
  PPT: "Presentation (PPT)",
  GST: "GST Certificate",
  SHOP_ACT: "Shop Act Licence",
  MSME: "MSME / Udyam",
  CERTIFICATE: "Certificate",
  BROCHURE: "Brochure",
  OTHER: "Other",
};
