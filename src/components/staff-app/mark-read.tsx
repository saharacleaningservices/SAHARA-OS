"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "@/server/actions/notifications";

/** Marks the listed notifications read once the Alerts screen has been seen. */
export function MarkReadOnView({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    if (key) void markNotificationsRead(key.split(",")).catch(() => {});
  }, [key]);
  return null;
}
