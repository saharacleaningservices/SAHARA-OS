"use client";

import { useEffect } from "react";
import { trackViewContent } from "@/components/public/marketing-tags";

/** Fires the ViewContent event once per page view (service / locality pages). Renders nothing. */
export function ViewContentTracker({ category, name, value }: { category: string; name: string; value?: number }) {
  useEffect(() => { trackViewContent({ category, name, value }); }, [category, name, value]);
  return null;
}
