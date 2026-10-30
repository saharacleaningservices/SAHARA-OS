// Per-key async mutex (single-process, matches the single Coolify instance + SQLite).
// Serialises "check slot availability -> create lead" for the same service date so two customers
// racing for the last team cannot both pass the capacity check.
const tails = new Map<string, Promise<void>>();

export async function withSlotLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const next = prev.then(() => gate);
  tails.set(key, next);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (tails.get(key) === next) tails.delete(key);
  }
}

/** YYYY-MM-DD from an unknown booking payload, or null (no lock needed without a date). */
export function slotLockKey(values: unknown): string | null {
  const d = values && typeof values === "object" ? (values as { serviceDate?: unknown }).serviceDate : null;
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null;
}
