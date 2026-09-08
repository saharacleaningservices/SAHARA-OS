import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/session";
import { isSameOrigin } from "@/lib/csrf";

const IMAGE_FOLDERS = ["photos", "signatures", "certificates", "staff", "logo"];
const AUDIO_FOLDERS = ["voice"];
const VIDEO_FOLDERS = ["videos"];
// Document folders accept images OR PDFs — staff KYC docs, company profile
// documents, uploaded MyBillBook / manual invoices.
const DOC_FOLDERS = ["staff-docs", "company-docs", "invoices"];
const ALLOWED_FOLDERS = [...IMAGE_FOLDERS, ...AUDIO_FOLDERS, ...VIDEO_FOLDERS, ...DOC_FOLDERS];
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_VIDEO_SIZE = 60 * 1024 * 1024; // 60MB
const MAX_DOC_SIZE = 20 * 1024 * 1024; // 20MB

const VIDEO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const AUDIO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "aac",
};

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = String(formData.get("folder") || "photos");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_FOLDERS.includes(folder)) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }

  const isAudio = AUDIO_FOLDERS.includes(folder);
  const isVideo = VIDEO_FOLDERS.includes(folder);
  const isDoc = DOC_FOLDERS.includes(folder);
  const maxSize = isVideo
    ? MAX_VIDEO_SIZE
    : isAudio
      ? MAX_AUDIO_SIZE
      : isDoc
        ? MAX_DOC_SIZE
        : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)` },
      { status: 400 }
    );
  }

  let ext: string;
  if (isVideo) {
    if (!file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Only video uploads are supported here" }, { status: 400 });
    }
    ext = VIDEO_EXT[file.type.split(";")[0]] ?? "mp4";
  } else if (isAudio) {
    if (!file.type.startsWith("audio/")) {
      return NextResponse.json({ error: "Only audio uploads are supported here" }, { status: 400 });
    }
    ext = AUDIO_EXT[file.type.split(";")[0]] ?? "webm";
  } else if (isDoc) {
    if (file.type === "application/pdf") {
      ext = "pdf";
    } else if (file.type.startsWith("image/")) {
      ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    } else {
      return NextResponse.json({ error: "Upload a PDF or image" }, { status: 400 });
    }
  } else {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported" }, { status: 400 });
    }
    ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  }

  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return NextResponse.json({ url: `/uploads/${folder}/${filename}` });
}
