// Builds the Cloud API "create message template" body (POST /{waba-id}/message_templates) from a CloudTemplate definition,
// so the CRM submits exactly what the repo defines — no retyping in WhatsApp Manager. Pure: no network, no secrets.
import type { CloudTemplate } from "@/lib/whatsapp-cloud-templates";

/** The WABA whose API, templates and settings must never be touched (SAHARA_MASTER_SYSTEM_RECORD §2). */
export const PROTECTED_WABA_ID = "108381505270532";

/** Templates the CRM may submit — the owner-approved Utility set of 2026-10-22. Anything else is refused. */
export const SUBMITTABLE_TEMPLATES = ["sahara_booking_confirmed_v5", "sahara_payment_received_v1", "sahara_job_completed_v1", "sahara_service_started_v1"] as const;

/** Customer-facing links must be on this host — never the CRM (app.) domain. */
export const BOOKING_HOST = "booking.saharacleaningservices.com";

/** URL buttons whose link is not on the booking host (e.g. BOOKING_URL unset, so links fell back to the CRM domain). */
export function foreignUrlButtons(t: CloudTemplate): string[] {
  return (t.buttons ?? [])
    .filter((b): b is Extract<typeof b, { type: "URL" }> => b.type === "URL")
    .filter((b) => { try { return new URL(b.url.replace("{{1}}", "x")).hostname !== BOOKING_HOST && !b.url.startsWith("https://g.page/"); } catch { return true; } })
    .map((b) => b.url);
}

type Component = Record<string, unknown>;

export function buildMetaTemplatePayload(t: CloudTemplate, opts: { headerHandle?: string | null } = {}) {
  const components: Component[] = [];
  if (t.header) {
    components.push({
      type: "HEADER",
      format: t.header.type,
      example: opts.headerHandle ? { header_handle: [opts.headerHandle] } : { header_url: [t.header.sample] },
    });
  }
  const hasVars = /\{\{\d+\}\}/.test(t.body);
  components.push({ type: "BODY", text: t.body, ...(hasVars ? { example: { body_text: [t.examples ?? []] } } : {}) });
  if (t.buttons?.length) {
    components.push({
      type: "BUTTONS",
      buttons: t.buttons.map((b) => {
        if (b.type === "URL") return { type: "URL", text: b.text, url: b.url, ...(b.url.endsWith("{{1}}") ? { example: [b.example ?? b.url.replace("{{1}}", "sample")] } : {}) };
        if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone };
        return { type: "QUICK_REPLY", text: b.text };
      }),
    });
  }
  return { name: t.name, language: t.language, category: t.category, components };
}
