import type { JobCardPdfProps } from "@/lib/pdf/job-card-document";

/**
 * Strip everything the team copy must never carry BEFORE rendering, so the
 * PDF can't leak it even if the layout changes: customer phone numbers,
 * payment figures and internal office notes.
 */
export function maskJobCardForAudience(props: JobCardPdfProps): JobCardPdfProps {
  if (props.audience !== "team") return props;
  return { ...props, mobile: "", alternateMobile: null, paymentStatus: "", jobValue: 0, advance: 0, balance: 0, notes: null };
}
