"use client";

import { useEffect } from "react";
import { markAnnouncementsRead } from "@/server/actions/staff-self";

/** Marks the listed announcements read once the screen has been seen. */
export function MarkAnnouncementsRead({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    if (key) void markAnnouncementsRead(key.split(",")).catch(() => {});
  }, [key]);
  return null;
}
