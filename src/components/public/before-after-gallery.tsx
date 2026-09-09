"use client";

import { useState } from "react";
import { toBeforeAfterPairs, type GalleryItemView } from "@/lib/gallery";

function BeforeAfterCard({
  before,
  after,
  caption,
}: {
  before: string;
  after: string;
  caption?: string | null;
}) {
  const [pos, setPos] = useState(50);
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="relative aspect-[4/3] w-full select-none">
<img src={after} alt="After" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${Math.max(pos, 0.01)}%` }}>
          <img src={before} alt="Before" className="absolute inset-0 h-full w-full max-w-none object-cover" style={{ width: `${10000 / Math.max(pos, 0.01)}%` }} />
          <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">BEFORE</span>
        </div>
        <span className="absolute right-2 top-2 rounded bg-primary/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">AFTER</span>
        <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }} />
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Reveal before / after"
          className="absolute inset-x-0 bottom-3 mx-auto w-[85%] cursor-ew-resize accent-primary"
        />
      </div>
      {caption && <figcaption className="px-3 py-2 text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

export function BeforeAfterGallery({ items, heading = true }: { items: GalleryItemView[]; heading?: boolean }) {
  const pairs = toBeforeAfterPairs(items);
  const videos = items.filter((i) => i.type === "VIDEO");
  const showcase = items.filter((i) => i.type === "PHOTO" && (i.kind === "GENERAL" || !i.pairKey));

  if (pairs.length === 0 && videos.length === 0 && showcase.length === 0) return null;

  return (
    <div className="space-y-5">
      {heading && (
        <div className="text-center">
          <h3 className="text-xl font-bold text-foreground">Before &amp; After</h3>
          <p className="text-sm text-muted-foreground">Real results from Sahara cleaning jobs across Pune</p>
        </div>
      )}

      {pairs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pairs.map((p, i) => (
            <BeforeAfterCard key={i} before={p.before!.url} after={p.after!.url} caption={p.caption ?? p.category} />
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <div key={v.id} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <video
                src={v.url}
                poster={v.thumbnailUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full bg-black object-cover"
              />
              {v.caption && <p className="px-3 py-2 text-xs text-muted-foreground">{v.caption}</p>}
            </div>
          ))}
        </div>
      )}

      {showcase.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {showcase.map((s) => (
            <figure key={s.id} className="overflow-hidden rounded-lg border border-border bg-white">
            <img src={s.url} alt={s.caption ?? "Sahara work"} className="aspect-square w-full object-cover" />
              {s.caption && <figcaption className="px-2 py-1.5 text-[11px] text-muted-foreground">{s.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
