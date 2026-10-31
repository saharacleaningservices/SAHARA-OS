"use client";

import { useSyncExternalStore } from "react";

// Sidebar unread badges. The notification bell already polls /api/notifications/feed every 20 s (visible tab only);
// that response now carries per-section unread counts, which the bell publishes here — no extra requests, no extra timers.

export type NavBadges = Record<string, number>;
const EVENT = "sahara-nav-badges";
let current: NavBadges = {};
const EMPTY: NavBadges = {};

export function publishNavBadges(next: NavBadges) {
  const a = JSON.stringify(current);
  const b = JSON.stringify(next);
  if (a === b) return;
  current = next;
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

export function useNavBadges(): NavBadges {
  return useSyncExternalStore(subscribe, () => current, () => EMPTY);
}
