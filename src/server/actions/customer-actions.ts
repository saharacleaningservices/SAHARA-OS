"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendSMS } from "@/lib/sms";
import { addTimelineEntry } from "@/server/timeline";

/** Quick customer search for the floating Customer Actions button. */
export async function searchCustomersQuick(q: string) {
  const session = await getSession();
  if (!session) return [];
  const term = q.trim();
  const digits = term.replace(/\D/g, "");

  const [leads, jobs, customers] = await Promise.all([
    db.lead.findMany({
      where: {
        deletedAt: null,
        OR: [
          term ? { name: { contains: term } } : {},
          digits ? { mobile: { contains: digits } } : {},
        ],
      },
      select: { name: true, mobile: true, id: true },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
    db.job.findMany({
      where: {
        deletedAt: null,
        OR: [
          term ? { customerName: { contains: term } } : {},
          digits ? { customerMobile: { contains: digits } } : {},
        ],
      },
      select: { customerName: true, customerMobile: true },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
    db.customer
      .findMany({
        where: { OR: [term ? { name: { contains: term } } : {}, digits ? { mobile: { contains: digits } } : {}] },
        select: { name: true, mobile: true },
        take: 15,
      })
      .catch(() => []),
  ]);

  const map = new Map<string, { name: string; mobile: string; leadId?: string }>();
  for (const l of leads) if (l.mobile && !map.has(l.mobile)) map.set(l.mobile, { name: l.name, mobile: l.mobile, leadId: l.id });
  for (const j of jobs) if (j.customerMobile && !map.has(j.customerMobile)) map.set(j.customerMobile, { name: j.customerName, mobile: j.customerMobile });
  for (const c of customers) if (c.mobile && !map.has(c.mobile)) map.set(c.mobile, { name: c.name, mobile: c.mobile });

  return [...map.values()].slice(0, 20);
}

/** Send an SMS to a customer + log it on their most recent lead. */
export async function sendCustomerSMS(mobile: string, name: string, body: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const digits = mobile.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return { error: "Invalid mobile number" };
  const text = (body || "").trim().slice(0, 480) || `Hi ${name}, this is ${session.name} from Sahara Cleaning Services.`;

  await sendSMS({ kind: "OTHER", toNumber: digits, toName: name, body: text, relatedType: "Customer", relatedId: digits });

  const lead = await db.lead.findFirst({ where: { mobile: digits, deletedAt: null }, orderBy: { createdAt: "desc" } });
  if (lead) {
    await addTimelineEntry({ leadId: lead.id, type: "CALL", body: `SMS sent by ${session.name}: ${text}` }).catch(() => {});
  }
  return { success: true as const };
}
