"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Captures the browser's current GPS position and saves a Google Maps link. */
export function ShareLocationButton({
  onShare,
}: {
  onShare: (mapLink: string) => Promise<{ error?: string; success?: boolean }>;
}) {
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function share() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location isn't supported on this device");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const link = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
        startTransition(async () => {
          const res = await onShare(link);
          if (res.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Location saved");
          router.refresh();
        });
      },
      () => {
        setBusy(false);
        toast.error("Couldn't get your location — check permission and try again");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={share} disabled={busy || pending}>
      {busy || pending ? <Loader2 className="animate-spin" /> : <MapPin className="size-3.5" />}
      Share Location
    </Button>
  );
}
