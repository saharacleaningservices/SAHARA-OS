"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { sendWhatsAppTemplate, WHATSAPP_TEST_MODE_NUMBERS } from "@/lib/whatsapp";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";
import { runLifecycleSweep, type SweepResult } from "@/server/lifecycle-reminders";

const deny = { success: false as const, error: "Only the Super Admin can do this." };

/** Super Admin: run one real sweep now (still needs WHATSAPP_REMINDERS=on; the outbound mode still decides who may receive). */
export async function runLifecycleSweepNow(): Promise<{ success: true; result: SweepResult } | { success: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return deny;
  const result = await runLifecycleSweep({ send: true, ignoreHours: true });
  revalidatePath("/admin/lifecycle-reminders");
  return { success: true, result };
}

/** Super Admin: send both reminder templates, with sample values, to the approved QA number only — to see them on a phone. */
export async function sendReminderTestMessages(): Promise<{ success: true; sent: number; errors: string[] } | { success: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return deny;
  const to = WHATSAPP_TEST_MODE_NUMBERS[0];
  const cases: [string, string[]][] = [
    ["sahara_rebook_reminder_v1", ["Test", "6 months", "Home Deep Cleaning"]],
    ["sahara_payment_due_reminder_v1", ["Test Traders", "TEST/001", "11,800", "05 Oct 2026"]],
  ];
  let sent = 0;
  const errors: string[] = [];
  for (const [name, params] of cases) {
    const t = templateByName(name)!;
    const r = await sendWhatsAppTemplate({ kind: "CUSTOMER_REMINDER", toNumber: to, toName: "QA test", templateName: t.name, languageCode: t.language, bodyParams: params, preview: renderTemplatePreview(t, params), relatedType: "ReminderTest", relatedId: name });
    if (r.sent) sent += 1;
    else errors.push(`${name}: ${String((r as { error?: string }).error ?? "not sent")}`);
  }
  revalidatePath("/admin/lifecycle-reminders");
  return { success: true, sent, errors };
}
