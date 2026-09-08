"use server";

import { revalidatePath } from "next/cache";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { COMPANY } from "@/lib/constants";
import { flushWhatsAppQueue, sendWhatsApp } from "@/lib/whatsapp";
import {
  ensureBackupToken,
  getResolvedIntegrations,
  markBackupVerified,
  markMapsVerified,
  markWhatsAppVerified,
  regenerateBackupToken,
  updateBackupSettings,
  updateMapsSettings,
  updateMyBillBookSettings,
  updateWhatsAppSettings,
} from "@/server/integrations";

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: "Not authorized" as const, session: null };
  if (session.role !== "ADMIN") return { error: "Only an admin can change integrations" as const, session: null };
  return { error: null, session };
}

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/admin/whatsapp-log");
}

// ── WhatsApp Cloud API ────────────────────────────────────────────────────

const whatsappSchema = z.object({
  accessToken: z.string().optional(),
  phoneNumberId: z.string().optional(),
  businessId: z.string().optional(),
  apiVersion: z.string().optional(),
});

export async function saveWhatsAppSettings(values: unknown) {
  const { error, session } = await requireAdmin();
  if (error) return { error };

  const parsed = whatsappSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };

  await updateWhatsAppSettings(
    {
      // Blank access-token field means "keep the existing one"; use the
      // explicit clear action to remove it.
      accessToken: parsed.data.accessToken?.trim() ? parsed.data.accessToken.trim() : undefined,
      phoneNumberId: parsed.data.phoneNumberId ?? "",
      businessId: parsed.data.businessId ?? "",
      apiVersion: parsed.data.apiVersion?.trim() || "v21.0",
    },
    session
  );

  // Credentials just changed — drain anything that was waiting.
  const flush = await flushWhatsAppQueue({ includeFailed: true });
  refresh();
  return {
    success: true as const,
    flushed: flush.ok ? { sent: flush.sent, failed: flush.failed } : null,
  };
}

export async function clearWhatsAppSettings() {
  const { error, session } = await requireAdmin();
  if (error) return { error };
  await updateWhatsAppSettings(
    { accessToken: "", phoneNumberId: "", businessId: "", apiVersion: "v21.0" },
    session
  );
  refresh();
  return { success: true as const };
}

export async function testWhatsApp(values: unknown) {
  const { error, session } = await requireAdmin();
  if (error) return { error };

  const parsed = z.object({ number: z.string().optional() }).safeParse(values);
  const explicit = parsed.success ? parsed.data.number?.trim() : "";

  let target = explicit || "";
  if (!target) {
    const me = await db.user.findUnique({ where: { id: session!.sub } });
    target = me?.phone?.trim() || COMPANY.phones[0];
  }
  if (!target) return { error: "No phone number to send the test to — add yours in your profile." };

  const { whatsapp } = await getResolvedIntegrations();
  if (!whatsapp.configured) return { error: "Save the WhatsApp credentials first." };

  const res = await sendWhatsApp({
    kind: "OTHER",
    toNumber: target,
    toName: session!.name,
    body: `✅ Sahara OS test message — WhatsApp Cloud API is connected. (${new Date().toLocaleString("en-IN")})`,
  });

  await markWhatsAppVerified(res.sent, res.sent ? null : res.error ?? "Send failed");
  refresh();

  if (res.sent) return { success: true as const, message: `Test sent to ${target}.` };
  return { error: res.error ?? "Meta rejected the test message. Check the token, phone number ID and that the number has opted in." };
}

// ── Google Maps ───────────────────────────────────────────────────────────

const mapsSchema = z.object({ apiKey: z.string().optional() });

export async function saveMapsSettings(values: unknown) {
  const { error, session } = await requireAdmin();
  if (error) return { error };

  const parsed = mapsSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const key = parsed.data.apiKey?.trim() ?? "";
  await updateMapsSettings({ apiKey: key, verifiedAt: null }, session);
  refresh();
  return { success: true as const };
}

export async function clearMapsSettings() {
  const { error, session } = await requireAdmin();
  if (error) return { error };
  await updateMapsSettings({ apiKey: "", verifiedAt: null }, session);
  refresh();
  return { success: true as const };
}

// ── MyBillBook ────────────────────────────────────────────────────────────

export async function saveMyBillBookSettings(values: unknown) {
  const { error, session } = await requireAdmin();
  if (error) return { error };
  const parsed = z.object({ apiKey: z.string().optional() }).safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  await updateMyBillBookSettings({ apiKey: parsed.data.apiKey?.trim() ?? "" }, session);
  refresh();
  return { success: true as const };
}

export async function clearMyBillBookSettings() {
  const { error, session } = await requireAdmin();
  if (error) return { error };
  await updateMyBillBookSettings({ apiKey: "" }, session);
  refresh();
  return { success: true as const };
}

export async function testMapsKey() {
  const { error } = await requireAdmin();
  if (error) return { error };

  const { googleMaps } = await getResolvedIntegrations();
  if (!googleMaps.apiKey) return { error: "Save the Maps API key first." };

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=Pune&key=${encodeURIComponent(googleMaps.apiKey)}`
    );
    const json = (await res.json().catch(() => ({}))) as { status?: string; error_message?: string };
    if (json.status === "OK" || json.status === "ZERO_RESULTS") {
      await markMapsVerified();
      refresh();
      return { success: true as const, message: "Google Maps API key is valid." };
    }
    return {
      error:
        json.error_message ||
        `Google rejected the key (${json.status ?? "unknown"}). Enable Geocoding API + Maps JavaScript API and check key restrictions.`,
    };
  } catch (e) {
    return { error: `Could not reach Google Maps: ${(e as Error).message}` };
  }
}

// ── Google Drive backup ───────────────────────────────────────────────────

const backupSchema = z.object({ gdriveFolderId: z.string().optional() });

export async function saveBackupSettings(values: unknown) {
  const { error, session } = await requireAdmin();
  if (error) return { error };

  const parsed = backupSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };

  await updateBackupSettings({ gdriveFolderId: parsed.data.gdriveFolderId ?? "" }, session);
  await ensureBackupToken(session);
  refresh();
  return { success: true as const };
}

export async function revealBackupToken() {
  const { error, session } = await requireAdmin();
  if (error) return { error };
  const token = await ensureBackupToken(session);
  return { success: true as const, token };
}

export async function regenerateBackupTokenAction() {
  const { error, session } = await requireAdmin();
  if (error) return { error };
  const token = await regenerateBackupToken(session);
  refresh();
  return { success: true as const, token };
}

/**
 * Verifies the backup pipeline end-to-end without downloading anything:
 * VACUUM INTO a temp snapshot, integrity_check, user-count sanity, record a
 * BackupEvent, then discard. Confirms the DB half of nightly Drive backups.
 */
export async function runBackupCheck() {
  const { error, session } = await requireAdmin();
  if (error) return { error };

  const root = process.cwd();
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const dbPath = path.resolve(root, dbUrl.replace(/^file:/, ""));
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "sahara-bkchk-"));
  const snapshot = path.join(workdir, "dev.db");

  try {
    // VACUUM INTO writes only to the target file; the source is read with a
    // brief shared lock (same approach as /api/backup).
    const live = new Database(dbPath);
    live.exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
    live.close();

    const check = new Database(snapshot, { readonly: true });
    const integrity = check.pragma("integrity_check", { simple: true }) as string;
    const { c: userCount } = check.prepare(`SELECT COUNT(*) AS c FROM "User"`).get() as { c: number };
    check.close();

    const sizeBytes = fs.statSync(snapshot).size;
    const ok = integrity === "ok" && userCount >= 1;

    await db.backupEvent.create({
      data: {
        kind: "MANUAL",
        triggeredBy: session!.email,
        fileName: null,
        sizeBytes,
        status: ok ? "SUCCESS" : "FAILED",
        notes: `Integrations page check — integrity ${integrity}, ${userCount} user(s)`,
      },
    });
    if (ok) await markBackupVerified();
    refresh();

    if (!ok) return { error: `Snapshot check failed (integrity ${integrity}, users ${userCount}).` };
    return {
      success: true as const,
      message: `Snapshot OK — ${(sizeBytes / 1024).toFixed(0)} KB, integrity ${integrity}, ${userCount} users.`,
    };
  } catch (e) {
    return { error: `Backup check failed: ${(e as Error).message}` };
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
}
