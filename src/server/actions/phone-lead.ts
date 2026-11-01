"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { createPhoneLead, type PhoneLeadInput } from "@/server/phone-lead";

/** Accounts (Shoyab) and Super Admin only. Authorized here, server-side — the dashboard button is just a shortcut. */
export async function logPhoneLead(values: PhoneLeadInput) {
  const s = await getSession();
  if (!s || (s.role !== "ADMIN" && s.role !== "ACCOUNTS")) return { ok: false as const, error: "Not allowed" };
  const res = await createPhoneLead({ id: s.sub, name: s.name }, values ?? { mobile: "" });
  if (res.ok) {
    revalidatePath("/leads");
    revalidatePath("/dashboard");
  }
  return res;
}
