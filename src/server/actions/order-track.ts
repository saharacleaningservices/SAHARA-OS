"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/rate-limit";
import { requestTrackCode, verifyTrackCode } from "@/server/order-track";

async function ip(): Promise<string | null> {
  try {
    return clientIp(await headers());
  } catch {
    return null;
  }
}

/** Public: send a 6-digit WhatsApp code for a Job ID + mobile (generic answer, rate-limited). */
export async function sendTrackCode(jobNumber: string, mobile: string) {
  return requestTrackCode({ jobNumber: String(jobNumber ?? "").slice(0, 40), mobile: String(mobile ?? "").slice(0, 20) }, await ip());
}

/** Public: check the code; on success returns the job's booking page URL. */
export async function checkTrackCode(jobNumber: string, mobile: string, code: string) {
  return verifyTrackCode({ jobNumber: String(jobNumber ?? "").slice(0, 40), mobile: String(mobile ?? "").slice(0, 20), code: String(code ?? "").slice(0, 10) }, await ip());
}
