import { last10 } from "@/lib/phone";

/**
 * Multi-number tracking (2026-11-01). Every inbound enquiry is tagged with the business line the customer used.
 *   Main-API        → the WhatsApp Cloud API number 9175220270 (default for every Cloud API webhook)
 *   Shoyab-GMB      → Shoyab's GMB / direct line (7083347130 unless WHATSAPP_LINE_SHOYAB overrides it)
 *   Francis-Direct  → Francis's line — set WHATSAPP_LINE_FRANCIS (10 digits) once the number is confirmed
 *   Main            → legacy / unknown (database default)
 */
export const SOURCE_LINES = ["Main", "Shoyab-GMB", "Francis-Direct", "Main-API"] as const;
export type SourceLine = (typeof SOURCE_LINES)[number];

export const MAIN_API_NUMBER = "9175220270";
export const SHOYAB_DEFAULT_NUMBER = "7083347130";

export const SOURCE_LINE_LABELS: Record<SourceLine, string> = {
  Main: "Main line",
  "Shoyab-GMB": "Shoyab · GMB line",
  "Francis-Direct": "Francis · Direct line",
  "Main-API": "Main · WhatsApp API",
};

export function isSourceLine(v: unknown): v is SourceLine {
  return typeof v === "string" && (SOURCE_LINES as readonly string[]).includes(v);
}

/** Maps a destination number (any format) to its source line. Unknown / empty → "Main-API" for Cloud API webhooks. */
export function sourceLineForNumber(raw: string | null | undefined, env: Record<string, string | undefined> = process.env): SourceLine {
  const n = last10(raw ?? "");
  if (n.length !== 10) return "Main-API";
  if (n === last10(env.WHATSAPP_LINE_SHOYAB || SHOYAB_DEFAULT_NUMBER)) return "Shoyab-GMB";
  const francis = last10(env.WHATSAPP_LINE_FRANCIS || "");
  if (francis.length === 10 && n === francis) return "Francis-Direct";
  return "Main-API";
}
