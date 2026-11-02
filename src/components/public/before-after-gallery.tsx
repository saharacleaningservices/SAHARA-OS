"use client";

import { toBeforeAfterPairs, type GalleryItemView } from "@/lib/gallery";
import { BeforeAfterSlider } from "@/components/public/before-after-slider";

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
            <BeforeAfterSlider key={i} before={p.before!.url} after={p.after!.url} alt={(p.caption ?? p.category ?? "").trim() || "Sahara cleaning job"} caption={p.caption ?? p.category} />
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
