// Local, deterministic follow-up suggestion — maps a lead's current pipeline
// stage to the next best action and a ready-to-send message. No external AI
// call, purely rule-based on the stage stored in the DB.
import { SERVICE_LABELS } from "@/lib/constants";

export type FollowUpSuggestion = {
  channelType: "CALL" | "WHATSAPP" | "SITE_VISIT";
  action: string;
  message: string;
};

const STAGE_ACTION: Record<string, { type: FollowUpSuggestion["channelType"]; verb: string }> = {
  NEW: { type: "CALL", verb: "Call to introduce our services and offer a site visit" },
  INTERESTED: { type: "CALL", verb: "Call to qualify the requirement and offer a site visit" },
  SITE_VISIT: { type: "SITE_VISIT", verb: "Follow up after the site visit and share a quotation" },
  QUOTATION: { type: "WHATSAPP", verb: "Check in on the quotation and address any questions" },
  NEGOTIATION: { type: "CALL", verb: "Call to close on pricing and confirm the booking" },
  CONFIRMED: { type: "WHATSAPP", verb: "Confirm the job schedule and crew details" },
  JOB_SCHEDULED: { type: "CALL", verb: "Confirm the visit timing a day ahead" },
};

export function suggestFollowUpAction(lead: {
  name: string;
  stage: string;
  area: string;
  service: string;
}): FollowUpSuggestion {
  const action = STAGE_ACTION[lead.stage] ?? { type: "CALL" as const, verb: "Reconnect and check on their interest" };
  const label = SERVICE_LABELS[lead.service] ?? lead.service;

  const message = `Hi ${lead.name}, just checking in on your ${label} enquiry for ${lead.area}. Let us know a good time to connect — we're happy to help!`;

  return { channelType: action.type, action: action.verb, message };
}
