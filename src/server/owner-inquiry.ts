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
import { INQUIRY_SOURCES, cleanText, isInquirySource, maskMobile, parseIndianMobile } from "@/lib/inquiry-input";
import { OUTCOME_KEYS, checkOutcome, outcomeLabel, parseNextFollowUp, type OutcomeCheck } from "@/lib/inquiry-outcomes";
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
  /** One of INQUIRY_SOURCES (default PHONE). */
  source?: unknown;
  /** AUTO = stop and ask when the number already exists; NEW = create anyway after only closed matches;
   *  REOPEN = reopen `leadId` (cancelled only); ALERT_EXISTING = no new lead, re-alert the team about `leadId`. */
  mode?: "AUTO" | "NEW" | "REOPEN" | "ALERT_EXISTING";
  leadId?: unknown;
};

type MatchRow = { id: string; leadNumber: string; name: string; stage: string; createdAt: string; service: string };
export type CreateInquiryResult =
  | { ok: true; leadId: string; leadNumber: string; reopened?: boolean; alertedExisting?: boolean; alerted: string[]; alertWarning?: string }
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

/**
 * Sends the alert and CHECKS that every chosen user actually got their notification row. notify() never throws,
 * so a silent failure would otherwise go unnoticed: missing users get one retry, and anything still missing is
 * written to the audit log (INQUIRY_ALERT_FAILED) and returned as a warning. The lead is saved either way.
 */
async function deliverAlerts(actor: Actor, lead: { id: string; leadNumber: string }, assignees: { id: string; name: string }[], note: string, existing: boolean) {
  const since = new Date(Date.now() - 1000);
  const have = async () => {
    const rows = await db.notification.findMany({ where: { kind: OWNER_INQUIRY_KIND, userId: { in: assignees.map((a) => a.id) }, createdAt: { gte: since }, meta: { contains: lead.id } }, select: { userId: true } });
    return new Set(rows.map((r) => r.userId));
  };
  try {
    await alertTeam(actor, lead, assignees, note, existing);
  } catch {
    /* handled by the check below */
  }
  let got = await have().catch(() => new Set<string>());
  let missing = assignees.filter((a) => !got.has(a.id));
  if (missing.length) {
    try {
      await alertTeam(actor, lead, missing, note, existing); // one retry for the users who did not receive it
    } catch {
      /* ignore */
    }
    got = await have().catch(() => new Set<string>());
    missing = assignees.filter((a) => !got.has(a.id));
  }
  if (missing.length) {
    await audit(actor, lead.id, "INQUIRY_ALERT_FAILED", `Alert to ${missing.map((m) => m.name).join(", ")} could not be delivered for ${lead.leadNumber}`);
    return `Saved, but the alert could not be delivered to ${missing.map((m) => m.name).join(", ")} — please tell them directly.`;
  }
  return undefined;
}

export async function createOwnerInquiry(actor: Actor, input: CreateInquiryInput): Promise<CreateInquiryResult> {
  if (actor.role !== "ADMIN") return { ok: false, error: "Only the Super Admin can add owner inquiries" };
  const m = parseIndianMobile(input.mobile);
  if (!m.ok) return { ok: false, error: m.error };
  const mobile = m.mobile;
  const name = cleanText(input.name, 100);
  const src = INQUIRY_SOURCES[isInquirySource(input.source) ? input.source : "PHONE"];
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
    const warn = await deliverAlerts(actor, lead, assignees, note, true);
    // Re-alerting never takes the inquiry away from its current owner; only an unassigned one is assigned.
    await db.lead.updateMany({ where: { id: lead.id, assignedToId: null }, data: { assignedToId: primaryAssignee(assignees) } });
    await addTimelineEntry({ leadId: lead.id, type: "SYSTEM", body: `Team alerted again by ${firstName(actor.name)}: ${assignees.map((a) => a.name).join(", ")}.${note ? ` Note: ${note}` : ""}`, authorId: actor.id });
    await audit(actor, lead.id, "INQUIRY_ALERT_RESENT", `Existing inquiry ${lead.leadNumber} re-sent to ${assignees.map((a) => a.name).join(", ")}`);
    return { ok: true, leadId: lead.id, leadNumber: lead.leadNumber, alertedExisting: true, alerted: assignees.map((a) => a.name), alertWarning: warn };
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
    const warn = await deliverAlerts(actor, old, assignees, note, false);
    return { ok: true, leadId: old.id, leadNumber: old.leadNumber, reopened: true, alerted: assignees.map((a) => a.name), alertWarning: warn };
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
      source: src.lead as never,
      acquisitionChannel: src.channel,
      firstTouchSource: src.channel,
      firstTouchAt: now,
      latestTouchSource: src.channel,
      latestTouchAt: now,
      notes: note || null,
      createdById: actor.id,
      assignedToId: primaryAssignee(assignees),
    },
  });
  await addTimelineEntry({
    leadId: lead.id,
    type: "SYSTEM",
    body: `Inquiry added by ${firstName(actor.name)} — Direct CRM Entry (owner) · source: ${src.label}. Assigned to ${assignees.map((a) => a.name).join(", ")}.${note ? ` Note: ${note}` : ""}`,
    authorId: actor.id,
  });
  await audit(actor, lead.id, "INQUIRY_CREATED_BY_OWNER", `Owner inquiry ${leadNumber} created via Direct CRM Entry (${maskMobile(mobile)})`, { assignees: assignees.map((a) => a.name), source: src.label });
  await audit(actor, lead.id, "INQUIRY_ASSIGNED", `Inquiry ${leadNumber} assigned to ${assignees.map((a) => a.name).join(", ")}`);
  const warn = await deliverAlerts(actor, lead, assignees, note, false);
  return { ok: true, leadId: lead.id, leadNumber, alerted: assignees.map((a) => a.name), alertWarning: warn };
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


// ─────────────────────────────────────────────────────────────────────────────
// One-click follow-up outcomes + the owner's tracker
// ─────────────────────────────────────────────────────────────────────────────

export type OutcomeInput = { leadId: unknown; outcome: unknown; note?: unknown; nextFollowUp?: unknown; alertId?: unknown };
type Staff = { id: string; name: string; email: string; role: string };

/** Operations only works leads inside its scope (NEW, or assigned to / created by them) — same rule as the lead list. */
function canActOnLead(user: Staff, lead: { stage: string; assignedToId: string | null; createdById: string | null }) {
  if (user.role === "ADMIN" || user.role === "ACCOUNTS") return true;
  if (user.role === "OPERATIONS") return lead.stage === "NEW" || lead.assignedToId === user.id || lead.createdById === user.id;
  return false;
}

/**
 * Records what a staff member did about an inquiry. Timeline entry (meta.kind = INQUIRY_OUTCOME) + audit row;
 * an optional dated follow-up becomes a normal CRM follow-up. It never changes the stage and never creates a
 * quotation, booking, job or payment. Double clicks within 20 s are ignored; the matching alert is acknowledged.
 */
export async function recordInquiryOutcome(user: Staff, input: OutcomeInput) {
  if (!["ADMIN", "ACCOUNTS", "OPERATIONS"].includes(user.role)) return { ok: false as const, error: "Not authorized" };
  const outcome = typeof input.outcome === "string" ? input.outcome : "";
  if (!OUTCOME_KEYS.includes(outcome)) return { ok: false as const, error: "Unknown outcome" };
  const leadId = typeof input.leadId === "string" ? input.leadId : "";
  const lead = await db.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, leadNumber: true, stage: true, assignedToId: true, createdById: true } });
  if (!lead || !canActOnLead(user, lead)) return { ok: false as const, error: "Inquiry not found" };
  const note = cleanText(input.note, 300);
  const next = parseNextFollowUp(input.nextFollowUp);
  if (!next.ok) return { ok: false as const, error: next.error };

  const recent = await db.timelineEntry.findFirst({
    where: { leadId, authorId: user.id, createdAt: { gte: new Date(Date.now() - 20_000) }, meta: { contains: `"outcome":"${outcome}"` } },
    select: { id: true },
  });
  if (!recent) {
    const label = outcomeLabel(outcome);
    const when = next.at ? next.at.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : null;
    await db.timelineEntry.create({
      data: {
        leadId,
        type: "FOLLOW_UP" as never,
        authorId: user.id,
        body: `${user.name}: ${label}${note ? ` — ${note}` : ""}${when ? ` (next follow-up ${when})` : ""}`,
        meta: JSON.stringify({ kind: "INQUIRY_OUTCOME", outcome, userId: user.id, userName: user.name, role: user.role, note: note || null, nextFollowUpAt: next.at?.toISOString() ?? null }),
      },
    });
    if (next.at) {
      await db.followUp.create({ data: { leadId, dueDate: next.at, type: "CALL" as never, notes: `After "${label}" by ${user.name}${note ? `: ${note}` : ""}`, assignedToId: user.id } }).catch(() => {});
    }
    await audit({ ...user }, leadId, `INQUIRY_OUTCOME_${outcome}`, `${user.name} recorded "${label}" on ${lead.leadNumber}${note ? ` — ${note}` : ""}`, { outcome, nextFollowUpAt: next.at?.toISOString() ?? null });
  }
  // Recording an outcome means the person has seen the inquiry: acknowledge their unread alert(s) for this lead
  // (the one they clicked from, or any other copy), so the owner's tracker shows it as seen.
  const unread = await db.notification.findMany({ where: { userId: user.id, kind: OWNER_INQUIRY_KIND, readAt: null, meta: { contains: leadId } }, select: { id: true } });
  const ids = new Set(unread.map((n) => n.id));
  if (typeof input.alertId === "string" && input.alertId) ids.add(input.alertId);
  for (const id of ids) await acknowledgeInquiryAlert(user, id);
  return { ok: true as const, already: Boolean(recent) };
}

export type TrackerRow = {
  leadId: string;
  leadNumber: string;
  name: string;
  mobile: string;
  stage: string;
  createdAt: string;
  source: string | null;
  recipients: { name: string; role: string; seenAt: string | null }[];
  outcomes: { id: string; outcome: string; label: string; by: string; role: string; at: string; note: string | null; nextFollowUpAt: string | null; check: OutcomeCheck }[];
};

/** Super Admin only (the action wrapper enforces it): recent owner-entered inquiries with who saw them and what was done. */
export async function getInquiryTracker(limit = 15): Promise<TrackerRow[]> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const marks = await db.auditLog.findMany({
    where: { entityType: "Lead", action: { in: ["INQUIRY_CREATED_BY_OWNER", "INQUIRY_REOPENED", "INQUIRY_ALERT_RESENT"] }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, meta: true, action: true },
    take: 200,
  });
  const ids = [...new Set(marks.map((m) => m.entityId))].slice(0, limit);
  if (!ids.length) return [];
  const [leads, notes, entries, quotes, jobs] = await Promise.all([
    db.lead.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, leadNumber: true, name: true, mobile: true, stage: true, createdAt: true, acquisitionChannel: true } }),
    db.notification.findMany({ where: { kind: OWNER_INQUIRY_KIND, OR: ids.map((id) => ({ meta: { contains: id } })) }, select: { userId: true, readAt: true, meta: true, createdAt: true, user: { select: { name: true, role: true } } }, orderBy: { createdAt: "desc" } }),
    db.timelineEntry.findMany({ where: { leadId: { in: ids }, type: "FOLLOW_UP" as never, meta: { contains: "INQUIRY_OUTCOME" } }, orderBy: { createdAt: "desc" }, select: { id: true, leadId: true, meta: true, createdAt: true } }),
    db.quotation.groupBy({ by: ["leadId"], where: { leadId: { in: ids } }, _count: { _all: true } }),
    db.job.groupBy({ by: ["leadId"], where: { leadId: { in: ids }, deletedAt: null }, _count: { _all: true } }),
  ]);
  const qCount = new Map(quotes.map((q) => [q.leadId, q._count._all]));
  const jCount = new Map(jobs.map((j) => [j.leadId ?? "", j._count._all]));
  return ids.flatMap((id) => {
    const l = leads.find((x) => x.id === id);
    if (!l) return [];
    const recips = new Map<string, { name: string; role: string; seenAt: string | null }>();
    for (const n of notes) {
      let m: { leadId?: string } = {};
      try {
        m = n.meta ? JSON.parse(n.meta) : {};
      } catch {
        /* ignore */
      }
      if (m.leadId !== id) continue;
      const prev = recips.get(n.userId);
      const seenAt = n.readAt ? n.readAt.toISOString() : null;
      // The latest alert for a user decides "seen": any unread alert keeps it pending.
      if (!prev) recips.set(n.userId, { name: n.user.name, role: n.user.role, seenAt });
      else if (!seenAt) prev.seenAt = null;
    }
    const outcomes = entries
      .filter((e) => e.leadId === id)
      .flatMap((e) => {
        try {
          const m = JSON.parse(e.meta ?? "{}");
          if (m.kind !== "INQUIRY_OUTCOME") return [];
          return [{ id: e.id, outcome: m.outcome as string, label: outcomeLabel(m.outcome), by: m.userName as string, role: m.role as string, at: e.createdAt.toISOString(), note: (m.note as string | null) ?? null, nextFollowUpAt: (m.nextFollowUpAt as string | null) ?? null, check: checkOutcome(m.outcome, { quotationCount: qCount.get(id) ?? 0, stage: l.stage, jobCount: jCount.get(id) ?? 0 }) }];
        } catch {
          return [];
        }
      });
    return [{ leadId: l.id, leadNumber: l.leadNumber, name: l.name, mobile: l.mobile, stage: String(l.stage), createdAt: l.createdAt.toISOString(), source: l.acquisitionChannel ?? null, recipients: [...recips.values()], outcomes }];
  });
}
