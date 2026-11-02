import { createHmac, timingSafeEqual } from "node:crypto";

/** `x-sahara-signature: sha256=<hex>` = HMAC-SHA256(raw body, secret). Constant-time compare. Unit-tested. */
export function verifySignature(raw: string, header: string | null, secret: string): boolean {
  const sig = (header ?? "").replace(/^sha256=/i, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(sig)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return timingSafeEqual(Buffer.from(sig.toLowerCase(), "hex"), Buffer.from(expected, "hex"));
}

export const signBody = (raw: string, secret: string) => `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
