import { readFile } from "node:fs/promises";
import path from "node:path";

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
    const absolute = path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
    const buffer = await readFile(absolute);
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
