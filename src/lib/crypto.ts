// Symmetric encryption for secrets stored in the database (currently the
// WhatsApp Cloud API access token and the backup token on
// IntegrationSettings). AES-256-GCM with a key derived from AUTH_SECRET via
// scrypt, so the same env var that signs sessions also protects these — no
// extra key to manage.
//
// Stored format:  v1:<salt b64>:<iv b64>:<tag b64>:<ciphertext b64>
// A value that isn't in this format is returned as-is by decryptSecret(),
// which keeps things working if a token was ever written in plaintext (e.g.
// a manual DB edit) and lets migrations be lazy.

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const PREFIX = "v1";

function masterSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET must be set (32+ chars) to store integration credentials securely."
    );
  }
  return secret;
}

function keyFor(saltB64: string): Buffer {
  return scryptSync(masterSecret(), Buffer.from(saltB64, "base64"), 32);
}

/** Encrypts a non-empty string. Returns "" for empty/nullish input. */
export function encryptSecret(plain: string | null | undefined): string {
  if (!plain) return "";
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(masterSecret(), salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    salt.toString("base64"),
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Reverses encryptSecret(). If `stored` isn't in the v1 envelope format it's
 * assumed to be plaintext and returned unchanged. Returns null for empty
 * input or if decryption fails (wrong AUTH_SECRET, corrupted value).
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split(":");
  if (parts.length !== 5 || parts[0] !== PREFIX) return stored; // plaintext / legacy
  const [, saltB64, ivB64, tagB64, ctB64] = parts;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFor(saltB64),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64")),
      decipher.final(),
    ]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}

/** True if a stored value is in the encrypted envelope format. */
export function isEncrypted(stored: string | null | undefined): boolean {
  return Boolean(stored && stored.startsWith(`${PREFIX}:`) && stored.split(":").length === 5);
}

/** Masks a secret for display: keeps the last 4 chars. */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(value.length - 4, 24))}${value.slice(-4)}`;
}
