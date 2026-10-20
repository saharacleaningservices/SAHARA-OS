// Retry rules for outbound WhatsApp Cloud API calls. Only failures where Meta clearly did NOT accept the message are
// retried: rate limiting (429) and gateway errors (502/503/504), plus a connection that never reached Meta. A timeout or
// an unexplained 500 is NOT retried — the message may already have gone out and WhatsApp has no idempotency key, so a
// retry could send the customer a duplicate. Failures that are not retried are left FAILED and the daily cron retries
// them (flushWhatsAppQueue includeFailed).

export const MAX_ATTEMPTS = 3;
const RETRY_STATUSES = new Set([429, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return RETRY_STATUSES.has(status);
}

/** A thrown fetch error that means the request never left (DNS / connection refused / reset before sending). */
export function isConnectError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError" || err.name === "TimeoutError") return false; // may have been accepted
  const code = String((err as { cause?: { code?: string } }).cause?.code ?? "");
  return err.name === "TypeError" && (code === "" || ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "UND_ERR_CONNECT_TIMEOUT"].includes(code));
}

/** Wait before attempt n+1 (n = attempts already made): 0.5 s, then 1.5 s; a Retry-After header (seconds, capped at 3) wins. */
export function backoffMs(attemptsMade: number, retryAfter?: string | null): number {
  const ra = Number(retryAfter);
  if (Number.isFinite(ra) && ra > 0) return Math.min(ra, 3) * 1000;
  return attemptsMade <= 1 ? 500 : 1500;
}
