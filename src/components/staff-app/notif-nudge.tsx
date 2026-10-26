"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, ChevronRight } from "lucide-react";

/** Shown on the home screen only while notification permission hasn't been asked yet. */
export function NotifNudge({ label }: { label: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow("Notification" in window && Notification.permission === "default");
  }, []);
  if (!show) return null;
  return (
    <Link href="/my/alerts" className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <BellRing className="size-5 shrink-0 text-primary" />
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}
