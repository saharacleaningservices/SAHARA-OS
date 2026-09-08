"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Crosshair, Link2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildEmbedUrl,
  buildMapLink,
  looksLikeMapsUrl,
  parseMapLink,
  type LatLng,
} from "@/lib/maps";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    __saharaMapsCb?: () => void;
  }
}

let mapsLoader: Promise<void> | null = null;

function loadMapsApi(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("sahara-google-maps");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Maps script failed")));
      return;
    }
    const script = document.createElement("script");
    script.id = "sahara-google-maps";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
    script.onload = () => resolve();
    script.onerror = () => {
      mapsLoader = null;
      reject(new Error("Could not load Google Maps"));
    };
    document.head.appendChild(script);
  });
  return mapsLoader;
}

const PUNE: LatLng = { lat: 18.5204, lng: 73.8567 };

export type MapsLocationValue = { mapLink: string; lat: number | null; lng: number | null };

export function MapsLocationInput({
  value,
  onChange,
  apiKey,
  label = "Google Maps Location",
}: {
  value: MapsLocationValue;
  onChange: (next: MapsLocationValue) => void;
  apiKey: string | null;
  label?: string;
}) {
  const [mode, setMode] = useState<"paste" | "current" | "pin">("paste");
  const [pasteText, setPasteText] = useState(value.mapLink ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coords: LatLng | null =
    value.lat != null && value.lng != null
      ? { lat: value.lat, lng: value.lng }
      : parseMapLink(value.mapLink);

  function commit(next: Partial<MapsLocationValue>) {
    setError(null);
    onChange({ mapLink: value.mapLink, lat: value.lat, lng: value.lng, ...next });
  }

  function applyPaste(raw: string) {
    const text = raw.trim();
    if (!text) {
      commit({ mapLink: "", lat: null, lng: null });
      return;
    }
    const parsed = parseMapLink(text);
    if (parsed) {
      commit({ mapLink: text, lat: parsed.lat, lng: parsed.lng });
    } else if (looksLikeMapsUrl(text)) {
      // Valid Maps URL we can't extract coordinates from (short link) — keep it.
      commit({ mapLink: text, lat: null, lng: null });
    } else {
      setError("Paste a Google Maps link, or coordinates like 18.5204, 73.8567");
    }
  }

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location isn't available on this device");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const link = buildMapLink(c);
        setPasteText(link);
        commit({ mapLink: link, lat: c.lat, lng: c.lng });
      },
      () => {
        setBusy(false);
        setError("Couldn't get your location — allow the location permission and try again");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function clearAll() {
    setPasteText("");
    commit({ mapLink: "", lat: null, lng: null });
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}

      <div className="flex flex-wrap gap-1.5">
        <ModeButton active={mode === "paste"} onClick={() => setMode("paste")} icon={<Link2 className="size-3.5" />}>
          Paste Maps Link
        </ModeButton>
        <ModeButton active={mode === "current"} onClick={() => setMode("current")} icon={<Crosshair className="size-3.5" />}>
          Use Current Location
        </ModeButton>
        <ModeButton
          active={mode === "pin"}
          onClick={() => setMode("pin")}
          icon={<MapPin className="size-3.5" />}
          disabled={!apiKey}
          title={apiKey ? undefined : "Add a Google Maps API key in Settings → Integrations to pin on a map"}
        >
          Pin on Map
        </ModeButton>
      </div>

      {mode === "paste" && (
        <div className="flex gap-2">
          <Input
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            onBlur={() => applyPaste(pasteText)}
            placeholder="https://maps.google.com/…  or  18.5204, 73.8567"
            inputMode="url"
          />
          <Button type="button" variant="outline" onClick={() => applyPaste(pasteText)}>
            Set
          </Button>
        </div>
      )}

      {mode === "current" && (
        <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
          {busy ? "Getting location…" : "Detect my location"}
        </Button>
      )}

      {mode === "pin" && apiKey && (
        <MapPicker
          apiKey={apiKey}
          initial={coords ?? PUNE}
          onPick={(c) => {
            const link = buildMapLink(c);
            setPasteText(link);
            commit({ mapLink: link, lat: c.lat, lng: c.lng });
          }}
          onError={(m) => setError(m)}
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {value.mapLink && (
        <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-2">
          <div className="flex items-center justify-between gap-2">
            <a
              href={value.mapLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 truncate text-xs font-medium text-primary hover:underline"
            >
              <MapPin className="size-3 shrink-0" />
              {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "Location link saved"}
            </a>
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <X className="size-3" /> Remove
            </button>
          </div>
          {apiKey && coords && (
            <iframe
              title="Location preview"
              className="h-40 w-full rounded-md border-0"
              loading="lazy"
              src={buildEmbedUrl(coords, apiKey)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  children,
  disabled,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
        disabled
          ? "cursor-not-allowed border-border text-muted-foreground/50"
          : active
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {icon}
      {children}
    </button>
  );
}

function MapPicker({
  apiKey,
  initial,
  onPick,
  onError,
}: {
  apiKey: string;
  initial: LatLng;
  onPick: (c: LatLng) => void;
  onError: (m: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMapsApi(apiKey)
      .then(() => {
        if (cancelled || !ref.current || !window.google?.maps) return;
        const g = window.google.maps;
        const map = new g.Map(ref.current, {
          center: initial,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });
        const marker = new g.Marker({ position: initial, map, draggable: true });
        setReady(true);

        const update = (latLng: any) => {
          const c = { lat: latLng.lat(), lng: latLng.lng() };
          marker.setPosition(c);
          onPick(c);
        };
        marker.addListener("dragend", (e: any) => update(e.latLng));
        map.addListener("click", (e: any) => update(e.latLng));
      })
      .catch((e: Error) => {
        if (!cancelled) onError(e.message || "Google Maps failed to load");
      });
    return () => {
      cancelled = true;
    };
    // initial is a fresh object each render; intentionally only run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return (
    <div className="relative">
      <div ref={ref} className="h-52 w-full rounded-lg border border-border bg-muted" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Loading map…
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Tap the map or drag the pin to set the exact spot.</p>
    </div>
  );
}
