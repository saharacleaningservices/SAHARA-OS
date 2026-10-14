// Owner Quick Add Inquiry (Altaf) — core logic, no session handling (the Server Action wrappers in
// src/server/actions/owner-inquiry.ts authenticate and authorize; the tests call this directly).
//
//   createOwnerInquiry   paste a mobile number → duplicate check → Lead (stage NEW, not a booking) →
//                        one OWNER_INQUIRY notification per assigned team member (in-app row + Web Push).
//   listInquiryAlerts    the caller's UNREAD OWNER_INQUIRY notifications, enriched per role:
//                        the customer's mobile only for roles that may see contact details.
//   acknowledgeInquiryAlert  marks the caller's own alert read (per user) + audit.
//
// No WhatsApp / SMS is sent. Nothing here books a service or touches jobs, payments or pricing.

import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { cleanText, maskMobile, parseIndianMobile } from "@/lib/inquiry-input";
import { canSeeCustomerContact } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/server/notify";
import { linkCustomerAndSite } from "@/server/customer-db";
import { addTimelineEntry } from "@/server/timeline";

export const OWNER_INQUIRY_KIND = "OWNER_INQUIRY";
const OPEN_STAGES = ["NEW", "INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION"] as const;
const ASSIGNABLE_ROLES = ["ACCOUNTS", "OPERATIONS"] as const;

export type Actor = { id: string; name: string; email: string; role: string };

export type CreateInquiryInput = {
  mobile: unknown;
  name?: unknown;
  note?: unknown;
  assigneeIds?: unknown;
  /** AUTO = stop and ask when the number already exists; NEW = create anyway after only closed matches;
   *  REOPEN = reopen `leadId` (cancelled only); ALERT_EXISTING = no new lead, re-alert the team about `leadId`. */
  mode?: "AUTO" | "NEW" | "REOPEN" | "ALERT_EXISTING";
  leadId?: unknown;
};

type MatchRow = { id: string; leadNumber: string; name: string; stage: string; createdAt: string; service: string };
export type CreateInquiryResult =
  | { ok: true; leadId: string; leadNumber: string; reopened?: boolean; alertedExisting?: boolean; alerted: string[] }
  | { ok: false; error: string }
  | { ok: false; duplicate: { active: MatchRow[]; closed: MatchRow[] } };

const firstName = (n: string) => n.trim().split(/\s+/)[0] || "Altaf";
const row = (l: { id: string; leadNumber: string; name: string; stage: string; createdAt: Date; service: string }): MatchRow => ({
  id: l.id,
  leadNumber: l.leadNumber,
  name: l.name,
  stage: l.stage,
  createdAt: l.createdAt.toISOString(),
  service: String(l.service),
});

/** Team members the owner can route an inquiry to (active Accounts / Operations logins). */
export async function listAssignees() {
  const users = await db.user.findMany({
    where: { isActive: true, role: { in: [...ASSIGNABLE_ROLES] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
  return users;
}

export async function findInquiryMatches(mobile10: string) {
  const where = { deletedAt: null, OR: [{ mobile: { endsWith: mobile10 } }, { whatsapp: { endsWith: mobile10 } }] };
  const [active, closed] = await Promise.all([
    db.lead.findMany({ where: { ...where, stage: { in: [...OPEN_STAGES] as never } }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.lead.findMany({ where: { ...where, stage: { notIn: [...OPEN_STAGES] as never } }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  return { active: active.map(row), closed: closed.map(row) };
}

async function audit(actor: Actor, entityId: string, action: string, summary: string, meta?: Record<string, unknown>) {
  await db.auditLog
    .create({ data: { entityType: "Lead", entityId, action, summary, actorName: actor.name, actorEmail: actor.email, meta: meta ? JSON.stringify(meta) : null } })
    .catch(() => {});
}

async function alertTeam(actor: Actor, lead: { id: string; leadNumber: string }, assignees: { id: string; name: string }[], note: string, existing: boolean) {
  const by = firstName(actor.name);
  await notify({
    kind: OWNER_INQUIRY_KIND,
    // No customer number in the notification text — roles that may not see it get a masked copy anyway.
    title: "NEW INQUIRY — RESPOND NOW",
    body: `New customer inquiry received from Sahara Cleaning Services — assigned by ${by}. Please review the inquiry and respond promptly.`,
    href: "/dashboard",
    extraUserIds: assignees.map((a) => a.id),
    critical: true,
    tag: `owner-inquiry-${lead.id}`,
    meta: { leadId: lead.id, leadNumber: lead.leadNumber, assignedBy: by, assignees: assignees.map((a) => a.name), note: note || null, existing },
  });
}

export async function createOwnerInquiry(actor: Actor, input: CreateInquiryInput): Promise<CreateInquiryResult> {
  if (actor.role !== "ADMIN") return { ok: false, error: "Only the Super Admin can add owner inquiries" };
  const m = parseIndianMobile(input.mobile);
  if (!m.ok) return { ok: false, error: m.error };
  const mobile = m.mobile;
  const name = cleanText(input.name, 100);
  const note = cleanText(input.note, 500);
  const ids = Array.isArray(input.assigneeIds) ? [...new Set(input.assigneeIds.filter((x): x is string => typeof x === "string"))].slice(0, 5) : [];
  if (!ids.length) return { ok: false, error: "Pick at least one team member to alert" };
  const assignees = await db.user.findMany({ where: { id: { in: ids }, isActive: true, role: { in: [...ASSIGNABLE_ROLES] } }, select: { id: true, name: true, role: true } });
  if (assignees.length !== ids.length) return { ok: false, error: "A selected team member is not available" };

  // Repeated clicks / double submits: ONE write per number + action every few seconds. It guards the window
  // where two concurrent requests both pass the duplicate check; a later repeat is caught by the duplicate
  // check itself once the first has been saved. Taken only right before a write, never for a duplicate lookup.
  const guard = (action: string) => rateLimit(`owner-inquiry:${action}:${actor.id}:${mobile}`, 1, 6).allowed;
  const busy = { ok: false as const, error: "Already submitted — please wait a moment" };

  const mode = input.mode ?? "AUTO";
  const matches = await findInquiryMatches(mobile);

  if (mode === "ALERT_EXISTING") {
    const lead = matches.active.find((l) => l.id === input.leadId);
    if (!lead) return { ok: false, error: "That inquiry is no longer open" };
    if (!guard("alert")) return busy;
    await alertTeam(actor, lead, assignees, note, true);
    // Re-alerting never takes the inquiry away from its current owner; only an unassigned one is assigned.
    await db.lead.updateMany({ where: { id: lead.id, assignedToId: null }, data: { assignedToId: primaryAssignee(assignees) } });
    await addTimelineEntry({ leadId: lead.id, type: "SYSTEM", body: `Team alerted again by ${firstName(actor.name)}: ${assignees.map((a) => a.name).join(", ")}.${note ? ` Note: ${note}` : ""}`, authorId: actor.id });
    await audit(actor, lead.id, "INQUIRY_ALERT_RESENT", `Existing inquiry ${lead.leadNumber} re-sent to ${assignees.map((a) => a.name).join(", ")}`);
    return { ok: true, leadId: lead.id, leadNumber: lead.leadNumber, alertedExisting: true, alerted: assignees.map((a) => a.name) };
  }

  if (matches.active.length) return { ok: false, duplicate: matches };
  if (matches.closed.length && mode === "AUTO") return { ok: false, duplicate: matches };

  if (mode === "REOPEN") {
    const old = await db.lead.findFirst({ where: { id: typeof input.leadId === "string" ? input.leadId : "", deletedAt: null, stage: "CANCELLED" as never } });
    if (!old) return { ok: false, error: "Only a cancelled inquiry can be reopened" };
    if (!guard("reopen")) return busy;
    await db.lead.update({ where: { id: old.id }, data: { stage: "NEW" as never, assignedToId: primaryAssignee(assignees) } });
    await addTimelineEntry({ leadId: old.id, type: "SYSTEM", body: `Inquiry reopened by ${firstName(actor.name)} and assigned to ${assignees.map((a) => a.name).join(", ")}.${note ? ` Note: ${note}` : ""}`, authorId: actor.id });
    await audit(actor, old.id, "INQUIRY_REOPENED", `Cancelled inquiry ${old.leadNumber} reopened`, { assignees: assignees.map((a) => a.name) });
    await alertTeam(actor, old, assignees, note, false);
    return { ok: true, leadId: old.id, leadNumber: old.leadNumber, reopened: true, alerted: assignees.map((a) => a.name) };
  }

  if (!guard("create")) return busy;
  // New inquiry. Same customer record for this mobile (created only if new); no address yet, so no site.
  const now = new Date();
  await linkCustomerAndSite({ mobile, name: name || `New inquiry ${mobile.slice(-4)}`, area: null, source: "CALL" });
  const leadNumber = await generateLeadNumber();
  const lead = await db.lead.create({
    data: {
      leadNumber,
      name: name || `New inquiry ${mobile.slice(-4)}`,
      mobile,
      whatsapp: mobile,
      area: "—",
      service: "HOME_DEEP_CLEANING" as never,
      source: "CALL" as never,
      acquisitionChannel: "Phone Call",
      firstTouchSource: "Phone Call",
      firstTouchAt: now,
      latestTouchSource: "Phone Call",
      latestTouchAt: now,
      notes: note || null,
      createdById: actor.id,
      assignedToId: primaryAssignee(assignees),
    },
  });
  await addTimelineEntry({
    leadId: lead.id,
    type: "SYSTEM",
    body: `Inquiry added by ${firstName(actor.name)} (owner) — source: Owner/Altaf. Assigned to ${assignees.map((a) => a.name).join(", ")}.${note ? ` Note: ${note}` : ""}`,
    authorId: actor.id,
  });
  await audit(actor, lead.id, "INQUIRY_CREATED_BY_OWNER", `Owner inquiry ${leadNumber} created (${maskMobile(mobile)})`, { assignees: assignees.map((a) => a.name) });
  await audit(actor, lead.id, "INQUIRY_ASSIGNED", `Inquiry ${leadNumber} assigned to ${assignees.map((a) => a.name).join(", ")}`);
  await alertTeam(actor, lead, assignees, note, false);
  return { ok: true, leadId: lead.id, leadNumber, alerted: assignees.map((a) => a.name) };
}

/** Lead owner field: prefer an Accounts login (full lead access); Operations sees NEW leads through its scope anyway. */
function primaryAssignee(a: { id: string; role: string }[]) {
  return (a.find((x) => x.role === "ACCOUNTS") ?? a[0]).id;
}

export type InquiryAlert = {
  id: string;
  leadId: string;
  leadNumber: string;
  name: string | null;
  /** Only for roles that may see customer contact details; null otherwise. */
  mobile: string | null;
  note: string | null;
  assignedBy: string;
  assignees: string[];
  createdAt: string;
  canOpen: boolean;
};

/** The caller's unread owner-inquiry alerts (offline users see them on their next load). */
export async function listInquiryAlerts(user: { id: string; role: string }, limit = 5): Promise<InquiryAlert[]> {
  const rows = await db.notification.findMany({ where: { userId: user.id, kind: OWNER_INQUIRY_KIND, readAt: null }, orderBy: { createdAt: "desc" }, take: limit });
  const out: InquiryAlert[] = [];
  for (const n of rows) {
    let meta: { leadId?: string; assignedBy?: string; assignees?: string[]; note?: string | null } = {};
    try {
      meta = n.meta ? JSON.parse(n.meta) : {};
    } catch {
      /* ignore */
    }
    if (!meta.leadId) continue;
    const lead = await db.lead.findFirst({ where: { id: meta.leadId, deletedAt: null }, select: { id: true, leadNumber: true, name: true, mobile: true, stage: true, assignedToId: true } });
    if (!lead) continue;
    const leadsAccess = user.role === "ADMIN" || user.role === "ACCOUNTS" || user.role === "OPERATIONS";
    // Operations only sees NEW leads or leads assigned to them (src/server/leads.ts operationsLeadWhere).
    const inScope = user.role !== "OPERATIONS" || lead.stage === "NEW" || lead.assignedToId === user.id;
    out.push({
      id: n.id,
      leadId: lead.id,
      leadNumber: lead.leadNumber,
      name: lead.name,
      mobile: canSeeCustomerContact(user.role) ? lead.mobile : null,
      note: meta.note ?? null,
      assignedBy: meta.assignedBy ?? "Altaf",
      assignees: meta.assignees ?? [],
      createdAt: n.createdAt.toISOString(),
      canOpen: leadsAccess && inScope,
    });
  }
  return out;
}

/** Marks the caller's own alert as seen. Per user: other recipients keep theirs until they acknowledge. */
export async function acknowledgeInquiryAlert(user: { id: string; name: string; email: string }, notificationId: string) {
  const n = await db.notification.findFirst({ where: { id: notificationId, userId: user.id, kind: OWNER_INQUIRY_KIND } });
  if (!n) return { ok: false as const, error: "Alert not found" };
  if (n.readAt) return { ok: true as const, already: true };
  const done = await db.notification.updateMany({ where: { id: n.id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  if (done.count === 1) {
    let leadId = "";
    try {
      leadId = (n.meta && JSON.parse(n.meta).leadId) || "";
    } catch {
      /* ignore */
    }
    if (leadId) {
      await db.auditLog.create({ data: { entityType: "Lead", entityId: leadId, action: "INQUIRY_ALERT_ACK", summary: `Inquiry alert acknowledged by ${user.name}`, actorName: user.name, actorEmail: user.email } }).catch(() => {});
      await addTimelineEntry({ leadId, type: "SYSTEM", body: `${user.name} acknowledged the new-inquiry alert.`, authorId: user.id }).catch(() => {});
    }
  }
  return { ok: true as const, already: done.count === 0 };
}
