import { db } from "@/lib/db";

const DEFAULT_ID = "default";

/** Returns the single company-settings row, creating it on first access. */
export async function getCompanySettings() {
  const existing = await db.companySettings.findUnique({ where: { id: DEFAULT_ID } });
  if (existing) return existing;
  try {
    return await db.companySettings.create({ data: { id: DEFAULT_ID } });
  } catch {
    // Another request created it first — read it back.
    return db.companySettings.findUniqueOrThrow({ where: { id: DEFAULT_ID } });
  }
}
