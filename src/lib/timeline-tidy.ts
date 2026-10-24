// Conversation timeline cleanup (owner 2026-10-24): no empty / placeholder entries ("Type more…") and no duplicate system lines.
export type TimelineLike = { id: string; type: string; body: string | null; audioUrl: string | null; createdAt: Date | string };

const PLACEHOLDER = /^\s*(type more|type a note|…|\.\.\.)\s*[….]*\s*$/i;
const BUBBLES = new Set(["NOTE", "VOICE", "CALL"]);

/** Drops placeholder notes and collapses the same system line repeated within two minutes (a double click, a retried save). Notes, voice memos and call logs are never merged. */
export function tidyTimeline<T extends TimelineLike>(entries: T[]): T[] {
  const out: T[] = [];
  const last = new Map<string, number>();
  for (const e of entries) {
    const body = (e.body ?? "").trim();
    if (BUBBLES.has(e.type) && e.type !== "VOICE" && (!body || PLACEHOLDER.test(body))) continue;
    if (!BUBBLES.has(e.type)) {
      const key = `${e.type}|${body}`;
      const at = new Date(e.createdAt).getTime();
      const prev = last.get(key);
      last.set(key, at);
      if (prev !== undefined && Math.abs(at - prev) < 120_000) continue;
    }
    out.push(e);
  }
  return out;
}
