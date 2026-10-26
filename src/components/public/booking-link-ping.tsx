"use client";

import { useEffect } from "react";

/** Records that a personalized booking link was opened (best-effort). */
export function BookingLinkPing({ token }: { token?: string }) {
  useEffect(() => {
    if (!token) return;
    fetch(`/api/booking-link/${encodeURIComponent(token)}/open`, { method: "POST", keepalive: true }).catch(() => {});
  }, [token]);
  return null;
}
