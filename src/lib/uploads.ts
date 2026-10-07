import path from "node:path";

/**
 * Where runtime uploads (photos, QR, documents) live. Next.js only serves files
 * that were in /public at build time, and the container's /app is rebuilt on every
 * deploy — so uploads go next to the database on the persistent volume
 * (DATABASE_URL), or UPLOADS_DIR when set. Served by src/app/uploads/[...path].
 * Local development (dev.db inside the project) keeps using public/uploads.
 */
export function uploadsRoot(): string {
  if (process.env.UPLOADS_DIR) return path.resolve(process.env.UPLOADS_DIR);
  const legacy = path.join(process.cwd(), "public", "uploads");
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) return legacy;
  const dbPath = path.resolve(process.cwd(), url.replace(/^file:/, ""));
  const dbDir = path.dirname(dbPath);
  // Database inside the app folder (local dev / no volume) → keep the old location.
  if (dbDir === process.cwd() || dbDir.startsWith(process.cwd() + path.sep)) return legacy;
  return path.join(dbDir, "uploads");
}

/** Old location — files uploaded before uploads moved to the persistent volume. */
export const legacyUploadsRoot = () => path.join(process.cwd(), "public", "uploads");
