"use client";

// Last-resort boundary: replaces the root layout when it fails to render. Must bring its own <html>/<body>
// and cannot rely on the app's CSS, so it is self-styled.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f8fd", color: "#0a2540" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Sahara OS hit a problem</p>
          <p style={{ margin: 0, maxWidth: 360, opacity: 0.75 }}>
            Your data is safe. Please try again{error.digest ? ` (ref ${error.digest})` : ""}.
          </p>
          <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0 20px", borderRadius: 10, border: 0, background: "#0B5ED7", color: "#fff", fontWeight: 600, fontSize: 15 }}>
            Try again
          </button>
          <a href="/login" style={{ fontSize: 14, color: "#0B5ED7" }}>Go to sign in</a>
        </div>
      </body>
    </html>
  );
}
