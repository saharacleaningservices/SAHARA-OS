// In-memory rate limiting — fine for this deployment since Render runs a
// single instance (WEB_CONCURRENCY=1, no horizontal scaling). If Sahara OS
// ever moves to multiple instances, this needs a shared store (Redis) since
// each instance would otherwise track its own separate counts.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Periodic cleanup so this Map never grows unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 60_000).unref?.();

/**
 * Returns { allowed, remaining, retryAfterSeconds }. Call once per attempt;
 * `key` should uniquely identify the caller (e.g. `login:ip:email`).
 */
export function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}
