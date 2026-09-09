// Connector layer — the single source of truth for third-party credentials.
//
// Every integration (WhatsApp Cloud API, Google Maps, Google Drive backup)
// resolves its config through here. Precedence: the IntegrationSettings row
// edited from /settings → Integrations wins; if a field is blank there, the
// matching environment variable is used. So credentials can be pasted once
// in the UI without a redeploy, and an existing env-var setup keeps working
// untouched.
//
// Secret fields are encrypted at rest (src/lib/crypto.ts). Never import this
// module from a client component — use getIntegrationStatusForUi() to hand
// the browser a secret-free status object.

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import type { SessionPayload } from "@/lib/session";

const ID = "default";

export type IntegrationSettingsRow = {
  id: string;
  whatsappAccessToken: string | null;
  whatsappPhoneNumberId: string | null;
  whatsappBusinessId: string | null;
  whatsappApiVersion: string;
  whatsappVerifiedAt: Date | null;
  whatsappLastError: string | null;
  googleMapsApiKey: string | null;
  googleMapsVerifiedAt: Date | null;
  mybillbookApiKey: string | null;
  mybillbookVerifiedAt: Date | null;
  backupToken: string | null;
  gdriveFolderId: string | null;
  backupVerifiedAt: Date | null;
  smsProvider: string | null;
  smsApiKey: string | null;
  smsSenderId: string | null;
  smsEndpoint: string | null;
  smsVerifiedAt: Date | null;
  updatedAt: Date;
  updatedBy: string | null;
};

/** The raw settings row, created on first access. */
export async function getIntegrationSettingsRow(): Promise<IntegrationSettingsRow> {
  const existing = await db.integrationSettings.findUnique({ where: { id: ID } });
  if (existing) return existing as IntegrationSettingsRow;
  try {
    return (await db.integrationSettings.create({ data: { id: ID } })) as IntegrationSettingsRow;
  } catch {
    return (await db.integrationSettings.findUniqueOrThrow({ where: { id: ID } })) as IntegrationSettingsRow;
  }
}

type Source = "db" | "env" | null;

export type ResolvedIntegrations = {
  whatsapp: {
    configured: boolean;
    source: Source;
    accessToken: string | null;
    phoneNumberId: string | null;
    businessId: string | null;
    apiVersion: string;
    verifiedAt: Date | null;
    lastError: string | null;
  };
  googleMaps: {
    configured: boolean;
    source: Source;
    apiKey: string | null;
    verifiedAt: Date | null;
  };
  mybillbook: {
    configured: boolean;
    source: Source;
    apiKey: string | null;
    verifiedAt: Date | null;
  };
  backup: {
    configured: boolean;
    token: string | null;
    tokenSource: Source;
    gdriveFolderId: string | null;
    verifiedAt: Date | null;
  };
  sms: {
    configured: boolean;
    source: Source;
    provider: string | null;
    apiKey: string | null;
    senderId: string | null;
    endpoint: string | null;
    verifiedAt: Date | null;
  };
};

/** Fully resolved + decrypted config for server-side use only. */
export async function getResolvedIntegrations(): Promise<ResolvedIntegrations> {
  const row = await getIntegrationSettingsRow();

  const waTokenDb = decryptSecret(row.whatsappAccessToken);
  const waTokenEnv = process.env.WHATSAPP_ACCESS_TOKEN || null;
  const waPhoneDb = row.whatsappPhoneNumberId || null;
  const waPhoneEnv = process.env.WHATSAPP_PHONE_NUMBER_ID || null;

  const waAccessToken = waTokenDb || waTokenEnv;
  const waPhoneNumberId = waPhoneDb || waPhoneEnv;
  const waConfigured = Boolean(waAccessToken && waPhoneNumberId);
  const waSource: Source = !waConfigured ? null : waTokenDb && waPhoneDb ? "db" : waTokenEnv && waPhoneEnv ? "env" : "db";

  const mapsKey =
    row.googleMapsApiKey ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    null;
  const mapsSource: Source = !mapsKey ? null : row.googleMapsApiKey ? "db" : "env";

  const mbbKeyDb = decryptSecret(row.mybillbookApiKey);
  const mbbKeyEnv = process.env.MYBILLBOOK_API_KEY || null;
  const mbbKey = mbbKeyDb || mbbKeyEnv;
  const mbbSource: Source = !mbbKey ? null : mbbKeyDb ? "db" : "env";

  const backupTokenDb = decryptSecret(row.backupToken);
  const backupTokenEnv = process.env.BACKUP_TOKEN || null;
  const backupToken = backupTokenDb || backupTokenEnv;
  const backupSource: Source = !backupToken ? null : backupTokenDb ? "db" : "env";

  const smsKeyDb = decryptSecret(row.smsApiKey);
  const smsKeyEnv = process.env.SMS_API_KEY || null;
  const smsApiKey = smsKeyDb || smsKeyEnv;
  const smsEndpoint = row.smsEndpoint || process.env.SMS_ENDPOINT || null;
  const smsConfigured = Boolean(smsApiKey && smsEndpoint);
  const smsSource: Source = !smsConfigured ? null : smsKeyDb ? "db" : "env";

  return {
    whatsapp: {
      configured: waConfigured,
      source: waSource,
      accessToken: waAccessToken,
      phoneNumberId: waPhoneNumberId,
      businessId: row.whatsappBusinessId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null,
      apiVersion: row.whatsappApiVersion || process.env.WHATSAPP_API_VERSION || "v21.0",
      verifiedAt: row.whatsappVerifiedAt,
      lastError: row.whatsappLastError,
    },
    googleMaps: {
      configured: Boolean(mapsKey),
      source: mapsSource,
      apiKey: mapsKey,
      verifiedAt: row.googleMapsVerifiedAt,
    },
    mybillbook: {
      configured: Boolean(mbbKey),
      source: mbbSource,
      apiKey: mbbKey,
      verifiedAt: row.mybillbookVerifiedAt,
    },
    backup: {
      configured: Boolean(backupToken),
      token: backupToken,
      tokenSource: backupSource,
      gdriveFolderId: row.gdriveFolderId || process.env.GDRIVE_FOLDER_ID || null,
      verifiedAt: row.backupVerifiedAt,
    },
    sms: {
      configured: smsConfigured,
      source: smsSource,
      provider: row.smsProvider || process.env.SMS_PROVIDER || null,
      apiKey: smsApiKey,
      senderId: row.smsSenderId || process.env.SMS_SENDER_ID || null,
      endpoint: smsEndpoint,
      verifiedAt: row.smsVerifiedAt,
    },
  };
}

// ── Status object safe to send to the browser (no secrets) ─────────────────

export type IntegrationStatusForUi = {
  whatsapp: {
    configured: boolean;
    source: Source;
    phoneNumberId: string;
    businessId: string;
    apiVersion: string;
    tokenHint: string; // masked, e.g. "••••••••ab12" or ""
    verifiedAt: string | null;
    lastError: string | null;
    queuedCount: number;
    failedCount: number;
  };
  googleMaps: {
    configured: boolean;
    source: Source;
    keyHint: string;
    verifiedAt: string | null;
  };
  backup: {
    configured: boolean;
    tokenSource: Source;
    token: string; // shown in full to the admin so it can be pasted into GitHub secrets
    gdriveFolderId: string;
    lastBackupAt: string | null;
    lastBackupStatus: string | null;
    autoBackupCount: number;
  };
};

export async function getIntegrationStatusForUi(): Promise<IntegrationStatusForUi> {
  const [resolved, row, queuedCount, failedCount, lastBackup, autoBackupCount] = await Promise.all([
    getResolvedIntegrations(),
    getIntegrationSettingsRow(),
    db.whatsAppMessage.count({ where: { status: "QUEUED" } }),
    db.whatsAppMessage.count({ where: { status: "FAILED" } }),
    db.backupEvent.findFirst({ where: { status: "SUCCESS" }, orderBy: { createdAt: "desc" } }),
    db.backupEvent.count({ where: { kind: "AUTO", status: "SUCCESS" } }),
  ]);

  return {
    whatsapp: {
      configured: resolved.whatsapp.configured,
      source: resolved.whatsapp.source,
      phoneNumberId: resolved.whatsapp.phoneNumberId ?? "",
      businessId: resolved.whatsapp.businessId ?? "",
      apiVersion: resolved.whatsapp.apiVersion,
      tokenHint: maskSecret(resolved.whatsapp.accessToken),
      verifiedAt: resolved.whatsapp.verifiedAt?.toISOString() ?? null,
      lastError: resolved.whatsapp.lastError,
      queuedCount,
      failedCount,
    },
    googleMaps: {
      configured: resolved.googleMaps.configured,
      source: resolved.googleMaps.source,
      keyHint: maskSecret(resolved.googleMaps.apiKey),
      verifiedAt: resolved.googleMaps.verifiedAt?.toISOString() ?? null,
    },
    backup: {
      configured: resolved.backup.configured,
      tokenSource: resolved.backup.tokenSource,
      token: resolved.backup.token ?? "",
      gdriveFolderId: row.gdriveFolderId ?? process.env.GDRIVE_FOLDER_ID ?? "",
      lastBackupAt: lastBackup?.createdAt.toISOString() ?? null,
      lastBackupStatus: lastBackup?.status ?? null,
      autoBackupCount,
    },
  };
}

// ── Writers ───────────────────────────────────────────────────────────────

async function audit(session: SessionPayload | null, summary: string, meta?: unknown) {
  await db.auditLog
    .create({
      data: {
        entityType: "Integration",
        entityId: ID,
        action: "UPDATE",
        summary,
        actorName: session?.name ?? null,
        actorEmail: session?.email ?? null,
        meta: meta ? JSON.stringify(meta) : null,
      },
    })
    .catch(() => {});
}

type FieldUpdate = string | null | undefined; // string = set, "" or null = clear, undefined = keep

function applyText(current: string | null, next: FieldUpdate): string | null {
  if (next === undefined) return current;
  const trimmed = (next ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function applySecret(current: string | null, next: FieldUpdate): string | null {
  if (next === undefined) return current;
  const trimmed = (next ?? "").trim();
  return trimmed === "" ? null : encryptSecret(trimmed);
}

export async function updateWhatsAppSettings(
  patch: {
    accessToken?: FieldUpdate;
    phoneNumberId?: FieldUpdate;
    businessId?: FieldUpdate;
    apiVersion?: FieldUpdate;
  },
  session: SessionPayload | null
): Promise<IntegrationSettingsRow> {
  const row = await getIntegrationSettingsRow();
  const updated = await db.integrationSettings.update({
    where: { id: ID },
    data: {
      whatsappAccessToken: applySecret(row.whatsappAccessToken, patch.accessToken),
      whatsappPhoneNumberId: applyText(row.whatsappPhoneNumberId, patch.phoneNumberId),
      whatsappBusinessId: applyText(row.whatsappBusinessId, patch.businessId),
      whatsappApiVersion: applyText(row.whatsappApiVersion, patch.apiVersion) ?? "v21.0",
      whatsappLastError: null,
      updatedBy: session?.email ?? null,
    },
  });
  await audit(session, "WhatsApp Cloud API settings updated");
  return updated as IntegrationSettingsRow;
}

export async function updateMapsSettings(
  patch: { apiKey?: FieldUpdate; verifiedAt?: Date | null },
  session: SessionPayload | null
): Promise<IntegrationSettingsRow> {
  const row = await getIntegrationSettingsRow();
  const updated = await db.integrationSettings.update({
    where: { id: ID },
    data: {
      googleMapsApiKey: applyText(row.googleMapsApiKey, patch.apiKey),
      googleMapsVerifiedAt: patch.verifiedAt === undefined ? row.googleMapsVerifiedAt : patch.verifiedAt,
      updatedBy: session?.email ?? null,
    },
  });
  await audit(session, "Google Maps API key updated");
  return updated as IntegrationSettingsRow;
}

export async function updateMyBillBookSettings(
  patch: { apiKey?: FieldUpdate },
  session: SessionPayload | null,
): Promise<IntegrationSettingsRow> {
  const row = await getIntegrationSettingsRow();
  const updated = await db.integrationSettings.update({
    where: { id: ID },
    data: {
      mybillbookApiKey: applySecret(row.mybillbookApiKey, patch.apiKey),
      mybillbookVerifiedAt: patch.apiKey === undefined ? row.mybillbookVerifiedAt : new Date(),
      updatedBy: session?.email ?? null,
    },
  });
  await audit(session, "MyBillBook API key updated");
  return updated as IntegrationSettingsRow;
}

export async function updateBackupSettings(
  patch: { gdriveFolderId?: FieldUpdate },
  session: SessionPayload | null
): Promise<IntegrationSettingsRow> {
  const row = await getIntegrationSettingsRow();
  const updated = await db.integrationSettings.update({
    where: { id: ID },
    data: {
      gdriveFolderId: applyText(row.gdriveFolderId, patch.gdriveFolderId),
      updatedBy: session?.email ?? null,
    },
  });
  await audit(session, "Google Drive backup settings updated");
  return updated as IntegrationSettingsRow;
}

/** Returns the plaintext backup token, generating + storing one if none exists. */
export async function ensureBackupToken(session: SessionPayload | null): Promise<string> {
  const resolved = await getResolvedIntegrations();
  if (resolved.backup.token) return resolved.backup.token;
  const token = randomBytes(24).toString("base64url");
  await db.integrationSettings.update({
    where: { id: ID },
    data: { backupToken: encryptSecret(token), updatedBy: session?.email ?? null },
  });
  await audit(session, "Backup token generated");
  return token;
}

export async function regenerateBackupToken(session: SessionPayload | null): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await getIntegrationSettingsRow();
  await db.integrationSettings.update({
    where: { id: ID },
    data: { backupToken: encryptSecret(token), updatedBy: session?.email ?? null },
  });
  await audit(session, "Backup token regenerated (previous token revoked)");
  return token;
}

export async function markWhatsAppVerified(ok: boolean, error?: string | null) {
  await getIntegrationSettingsRow();
  await db.integrationSettings.update({
    where: { id: ID },
    data: {
      whatsappVerifiedAt: ok ? new Date() : undefined,
      whatsappLastError: ok ? null : error ?? "Verification failed",
    },
  });
}

export async function markMapsVerified() {
  await getIntegrationSettingsRow();
  await db.integrationSettings.update({
    where: { id: ID },
    data: { googleMapsVerifiedAt: new Date() },
  });
}

export async function markBackupVerified() {
  await getIntegrationSettingsRow();
  await db.integrationSettings.update({
    where: { id: ID },
    data: { backupVerifiedAt: new Date() },
  });
}
