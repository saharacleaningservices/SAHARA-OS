// Server-safe (no "use client"): shared by the notifications feed route and the sidebar hook.

/** Which sidebar link (by href) each unread notification kind lights up. Pure data, shared by server (feed) and client. */
export const KIND_TO_NAV_HREF: Record<string, string> = {
  NEW_INQUIRY: "/leads",
  FOLLOWUP_DUE: "/leads",
  STALE_LEAD: "/leads",
  LEAD_UNCONTACTED: "/leads",
  SITE_VISIT: "/leads",
  OPS_FOLLOWUP_DUE: "/leads",
  OPS_QUOTATION_FOLLOWUP: "/leads",
  NEW_BOOKING: "/jobs",
  CREW_UPDATE: "/jobs",
  OPS_TEAM_UNASSIGNED: "/jobs",
  OPS_JOB_CLOSURE: "/jobs",
  OPS_ESCALATION: "/jobs",
  PAYMENT_RECEIVED: "/payments",
  OPS_PAYMENT_DUE: "/payments",
  STAFF_ATTENDANCE: "/attendance",
  STAFF_OVERTIME: "/attendance",
  STAFF_REGISTRATION: "/staff",
};

