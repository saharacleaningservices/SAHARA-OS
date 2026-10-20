// Client-side image compression for job photos: downscale to a sensible long edge and re-encode as WebP, which keeps a
// 4 MB phone photo near 150-300 KB. Falls back to the original file whenever the browser cannot do it or the result
// is not smaller, so an upload never fails because of compression. Browser only (canvas + createImageBitmap).

export type CompressOptions = { maxEdge?: number; quality?: number };

/** Target size after fitting `w` x `h` inside a square of `maxEdge` (never upscales). */
export function fitWithin(w: number, h: number, maxEdge: number): { w: number; h: number } {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

export async function compressToWebp(file: File, { maxEdge = 1600, quality = 0.8 }: CompressOptions = {}): Promise<File> {
  if (!file.type.startsWith("image/") || (file.type === "image/webp" && file.size < 300 * 1024)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const { w, h } = fitWithin(bmp.width, bmp.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    // Some browsers silently return PNG when WebP is unsupported — only accept a real, smaller WebP.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}
