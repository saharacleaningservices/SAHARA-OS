import { db } from "@/lib/db";

// The controlled production QA test: only the pending acknowledgement for
// lead LD-2026-0126 is kept out of the stale-queue cancellation — not every
// message ever addressed to that number.
export async function qaKeepIds() {
  const lead = await db.lead.findFirst({ where: { leadNumber: "LD-2026-0126", mobile: "9921215250" }, select: { id: true } });
  if (!lead) return [];
  const rows = await db.whatsAppMessage.findMany({
    where: { status: { in: ["QUEUED", "FAILED"] }, relatedType: "Lead", relatedId: lead.id, toNumber: "919921215250" },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
