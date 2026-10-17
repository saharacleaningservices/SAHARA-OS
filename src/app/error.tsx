"use client";

import { useEffect } from "react";
import Link from "next/link";

// Error boundary for every page (2026-10-18 stability audit: the app had none, so any render error
// replaced the whole screen with Next's bare error page). Keeps the app shell where it can, never shows
// a stack trace, and lets the user retry without a full reload. The digest ties the screen to the server log line.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ui-error]", error.digest ?? "", error.message);
  }, [error]);
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-lg font-semibold text-foreground">Something went wrong on this page</p>
      <p className="text-sm text-muted-foreground">
        Your data is safe. Try again — if it keeps happening, tell the office{error.digest ? ` (ref ${error.digest})` : ""}.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Try again
        </button>
        <Link href="/dashboard" className="flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
