import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon / PWA app icon.
//
// Preference order (mirrors CompanyLogo's resolution order):
//   1. The official brand PNG at /public/brand/sahara-logo.png, once the
//      owner drops it in — read straight off disk and embedded so the icon
//      always matches the real logo everywhere else.
//   2. The bundled placeholder mark below — guaranteed to exist in every
//      build, so this can never break even though the brand file genuinely
//      does not exist yet.
async function readBrandPngDataUrl(): Promise<string | null> {
  try {
    const filePath = path.join(process.cwd(), "public", "brand", "sahara-logo-hires.png"); // 1102x465 — keep its aspect ratio below
    const buf = await readFile(filePath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function AppleIcon() {
  const brandDataUrl = await readBrandPngDataUrl();

  if (brandDataUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            borderRadius: 40,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brandDataUrl}
            width={150}
            height={63} // 150 × 465 / 1102: the logo's real aspect ratio — never forced into a square (that stretched it into an oval)
            style={{ objectFit: "contain" }}
          />
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B5ED7",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 108,
            height: 108,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="62" height="62" viewBox="0 0 64 64" fill="none">
            <path
              d="M14 33 L26 45 L50 17"
              stroke="#ffffff"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    ),
    { ...size }
  );
}
