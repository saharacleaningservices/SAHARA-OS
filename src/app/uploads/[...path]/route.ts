import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { legacyUploadsRoot, uploadsRoot } from "@/lib/uploads";
import { getSession } from "@/lib/session";

// Serves runtime uploads (/uploads/<folder>/<file>) from the persistent uploads
// folder (see lib/uploads.ts), falling back to the old public/uploads location.
// Filenames are random and never reused, so responses are cached long-term.

const TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
  pdf: "application/pdf", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav", aac: "audio/aac",
};

// Private folders: never public, never cached by proxies. Everything else
// (job photos, gallery, logo, company documents shared with customers) stays public.
const OFFICE = ["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"];
const PRIVATE_FOLDERS: Record<string, string[]> = {
  "staff-docs": ["ADMIN", "ACCOUNTS"], // staff KYC documents
  invoices: ["ADMIN", "ACCOUNTS"], // payment / invoice attachments
  voice: OFFICE, // lead voice notes
  "call-recordings": OFFICE, // customer call audio from the Helper app (private, never cached)
  signatures: OFFICE, // customer signatures (PDFs read them from disk, not over HTTP)
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  // Only plain file/folder names — no traversal, no hidden files.
  if (!segments?.length || segments.some((s) => !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s) || s.includes(".."))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const allowed = PRIVATE_FOLDERS[segments[0]];
  if (allowed) {
    const session = await getSession();
    if (!session || !allowed.includes(session.role)) return new NextResponse("Not found", { status: 404 });
  }
  const rel = path.join(...segments);
  for (const root of [uploadsRoot(), legacyUploadsRoot()]) {
    const file = path.join(root, rel);
    if (!file.startsWith(root + path.sep)) continue;
    try {
      const data = await readFile(file);
      const ext = path.extname(file).slice(1).toLowerCase();
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": TYPES[ext] ?? "application/octet-stream",
          "Cache-Control": allowed ? "private, no-store" : "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // try the next location
    }
  }
  return new NextResponse("Not found", { status: 404 });
}
