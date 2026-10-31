import { timingSafeEqual } from "node:crypto";

/** Constant-time string comparison (length leak only). Use for every secret/signature check. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
