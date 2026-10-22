import type { JobCardPdfProps } from "@/lib/pdf/job-card-document";

/**
 * Strip everything the team copy must never carry BEFORE rendering, so the PDF can't leak it even if the layout changes.
 * Owner 2026-10-23: the team copy carries ONLY job ID, service category, package, date & time slot, site address (with its
 * map link) and the assigned team / supervisor — no customer name or phone, no payment figures, no notes or instructions.
 */
export function maskJobCardForAudience(props: JobCardPdfProps): JobCardPdfProps {
  if (props.audience !== "team") return props;
  return { ...props, customerName: "", mobile: "", alternateMobile: null, officeAddress: null, paymentStatus: "", jobValue: 0, advance: 0, balance: 0, notes: null, instructions: null };
}
