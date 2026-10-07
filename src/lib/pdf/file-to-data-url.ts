import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadsRoot } from "@/lib/uploads";

/**
 * Reads a file under /public and returns it as a data: URL for embedding in
 * a @react-pdf/renderer document. Only PNG/JPG are supported by react-pdf's
 * <Image> — SVGs (used for seed placeholders) are skipped and return null,
 * which callers render around gracefully.
 */
export async function publicFileToDataUrl(publicPath: string): Promise<string | null> {
  if (!publicPath) return null;
  const ext = path.extname(publicPath).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(ext)) return null;

  try {
    const rel = publicPath.replace(/^\//, "");
    // Runtime uploads live in the persistent uploads folder (lib/uploads.ts).
    const candidates = rel.startsWith("uploads/")
      ? [path.join(uploadsRoot(), rel.slice("uploads/".length)), path.join(process.cwd(), "public", rel)]
      : [path.join(process.cwd(), "public", rel)];
    let buffer: Buffer | null = null;
    for (const c of candidates) {
      buffer = await readFile(c).catch(() => null);
      if (buffer) break;
    }
    if (!buffer) return null;
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * The brand logo for a PDF header: the admin-uploaded logo if it's a raster,
 * else the committed /brand/sahara-logo.png. Returns null → the document
 * renders its styled text header instead (never a broken image).
 */
export async function resolveBrandLogoDataUrl(logoUrl?: string | null): Promise<string | null> {
  return (await publicFileToDataUrl(logoUrl ?? "")) ?? (await publicFileToDataUrl("/brand/sahara-logo.png"));
}
