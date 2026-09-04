import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon / PWA app icon — same brand mark as src/app/icon.svg,
// rendered as a real PNG via Next's built-in ImageResponse so no external
// image-processing tool is needed. This file (and icon.svg) live in the
// git-committed app source, so — unlike a logo uploaded through Settings —
// they always ship with the build and can never go missing after a deploy.
export default function AppleIcon() {
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
