"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/rate-limit";
import { publicBookLeadCore } from "@/server/public-booking-core";

/** Caller IP from the current HTTP request, or null outside a request scope. */
async function requestIp(): Promise<string | null> {
  try {
    return clientIp(await headers());
  } catch {
    return null;
  }
}

/**
 * Public, unauthenticated booking form submission (Customer Form Link).
 * The logic lives in src/server/public-booking-core.ts (shared with the public REST API); this wrapper only
 * supplies the caller IP so per-IP throttling keeps working exactly as before.
 */
export async function publicBookLead(values: unknown) {
  return publicBookLeadCore(values, { ip: await requestIp() });
}
