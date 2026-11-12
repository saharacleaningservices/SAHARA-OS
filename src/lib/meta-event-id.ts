// One Meta event_id per lead, shared by the browser Pixel and the Conversions API (owner 2026-11-12, Events Manager audit).
//
// Meta de-duplicates a browser event and a server event only when event_name AND event_id match. trackLead() already sends one
// id to both, but a single customer can reach trackLead() more than once (step-1 lead capture, the final submit, a retry or a
// double tap) and each call used to mint a new id — Meta then counted several Leads for one person. The id is now remembered per
// mobile number for the length of the booking session, so every call for that customer reuses the same id and Meta keeps one Lead.

export const LEAD_EVENT_ID_TTL_MS = 30 * 60 * 1000;
const KEY_PREFIX = "sahara_meta_lead_";

export type EventIdStore = Pick<Storage, "getItem" | "setItem">;

/** RFC 4122 v4 UUID; falls back to a random 32-char hex when crypto.randomUUID is unavailable. */
export function newEventId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * The event id for this customer's Lead. The same mobile within 30 minutes gets the same id; anyone else (or a later visit)
 * gets a fresh UUID. Storage is optional — without it (private mode, SSR) every call is a fresh id, exactly as before.
 */
export function leadEventId(mobile: string | null | undefined, store?: EventIdStore | null, now = Date.now(), mint: () => string = newEventId): string {
  const digits = (mobile ?? "").replace(/\D/g, "").slice(-10);
  if (digits.length !== 10 || !store) return mint();
  const key = `${KEY_PREFIX}${digits}`;
  try {
    const raw = store.getItem(key);
    if (raw) {
      const saved = JSON.parse(raw) as { id?: unknown; at?: unknown };
      if (typeof saved.id === "string" && saved.id.length >= 8 && typeof saved.at === "number" && now - saved.at < LEAD_EVENT_ID_TTL_MS && now >= saved.at) return saved.id;
    }
  } catch {
    /* unreadable entry — mint a new id below */
  }
  const id = mint();
  try {
    store.setItem(key, JSON.stringify({ id, at: now }));
  } catch {
    /* storage full / blocked — the id still works for this call */
  }
  return id;
}

/** Server side: remembers (event name, event id) pairs already relayed so a retried or double-sent request reaches Meta once. */
const RELAY_TTL_MS = 10 * 60 * 1000;
const relayed = new Map<string, number>();

/** True when this event was already relayed in the last 10 minutes; otherwise records it and returns false. */
export function alreadyRelayed(eventName: string, eventId: string, now = Date.now()): boolean {
  for (const [k, at] of relayed) if (now - at > RELAY_TTL_MS) relayed.delete(k);
  const key = `${eventName}:${eventId}`;
  if (relayed.has(key)) return true;
  relayed.set(key, now);
  return false;
}

export function __resetRelayed() {
  relayed.clear();
}
