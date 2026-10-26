// Web Push (VAPID) — sends browser push notifications to subscribed devices.
//
// The VAPID keypair is generated once and stored on the IntegrationSettings
// row (private key encrypted at rest like the WhatsApp token). It can also be
// supplied by env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT).
// If neither is present, getVapidKeys() generates + persists a fresh pair.

import webpush from "web-push";
import { db } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

const ID = "default";

export type PushPayload = {
  title: string;
  body?: string;
  href?: string;
  critical?: boolean;
  tag?: string;
  /** Staff App event — the service worker uses the Sahara vibration pattern + in-app chime. */
  staffApp?: boolean;
};

async function ensureRow() {
  const existing = await db.integrationSettings.findUnique({ where: { id: ID } });
  if (existing) return existing;
  try {
    return await db.integrationSettings.create({ data: { id: ID } });
  } catch {
    return db.integrationSettings.findUniqueOrThrow({ where: { id: ID } });
  }
}

let cached: { publicKey: string; privateKey: string; subject: string } | null = null;

export async function getVapidKeys() {
  if (cached) return cached;

  const envPub = process.env.VAPID_PUBLIC_KEY;
  const envPriv = process.env.VAPID_PRIVATE_KEY;
  const subjectDefault = process.env.VAPID_SUBJECT || "mailto:contact@saharacleaningservices.com";
  if (envPub && envPriv) {
    cached = { publicKey: envPub, privateKey: envPriv, subject: subjectDefault };
    return cached;
  }

  const row = await ensureRow();
  const rowPriv = decryptSecret(row.webPushPrivateKey);
  if (row.webPushPublicKey && rowPriv) {
    cached = { publicKey: row.webPushPublicKey, privateKey: rowPriv, subject: row.webPushSubject || subjectDefault };
    return cached;
  }

  const generated = webpush.generateVAPIDKeys();
  await db.integrationSettings.update({
    where: { id: ID },
    data: {
      webPushPublicKey: generated.publicKey,
      webPushPrivateKey: encryptSecret(generated.privateKey),
      webPushSubject: subjectDefault,
    },
  });
  cached = { publicKey: generated.publicKey, privateKey: generated.privateKey, subject: subjectDefault };
  return cached;
}

export async function getVapidPublicKey(): Promise<string> {
  return (await getVapidKeys()).publicKey;
}

/** Push to every subscription for the given user ids. Prunes dead subscriptions. */
export async function pushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return { sent: 0, failed: 0 };
  const keys = await getVapidKeys();
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

  const subs = await db.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
      }
    }),
  );

  if (dead.length) await db.pushSubscription.deleteMany({ where: { id: { in: dead } } });
  if (sent) await db.pushSubscription.updateMany({ where: { userId: { in: userIds } }, data: { lastOkAt: new Date() } });
  return { sent, failed };
}
