"use client";

import { useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_FEATURED_REVIEWS,
  SHOWN_ON_BOOKING_PAGE,
  parseFeaturedReviews,
  serializeFeaturedReviews,
  type FeaturedReview,
} from "@/lib/featured-reviews";

/**
 * Simple Name / Review / Rating rows in place of the old raw-JSON textarea. Writes the same JSON shape back through
 * onChange. If the stored value is not a JSON list, it is shown as-is with a warning and only replaced when the admin
 * chooses to start a fresh list, so nothing already saved is lost silently.
 */
export function FeaturedReviewsEditor({ value, onChange }: { value: string; onChange: (json: string) => void }) {
  const initial = parseFeaturedReviews(value);
  const [rows, setRows] = useState<FeaturedReview[]>(initial.ok ? initial.reviews : []);
  const [raw, setRaw] = useState<string | null>(initial.ok ? null : initial.raw);

  const update = (next: FeaturedReview[]) => {
    setRows(next);
    onChange(serializeFeaturedReviews(next));
  };

  if (raw !== null) {
    return (
      <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30">
        <p className="font-medium">The saved reviews are not in the expected format, so they are shown as text.</p>
        <Textarea rows={4} value={raw} onChange={(e) => { setRaw(e.target.value); onChange(e.target.value); }} aria-label="Saved featured reviews (raw text)" />
        <Button type="button" variant="outline" size="sm" onClick={() => { setRaw(null); update([]); }}>
          Start a new list (replaces the text above when you save)
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No featured reviews yet. The booking page then shows only your Google rating and the &ldquo;View all&rdquo; button.</p>}
      {rows.map((r, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Review {i + 1}
              {i >= SHOWN_ON_BOOKING_PAGE && " · not shown (booking page shows the first 5)"}
            </span>
            <Button type="button" variant="ghost" size="sm" aria-label={`Remove review ${i + 1}`} onClick={() => update(rows.filter((_, j) => j !== i))}>
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label htmlFor={`review-name-${i}`}>Name</Label>
              <Input id={`review-name-${i}`} value={r.name} maxLength={60} placeholder="Priya S." onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            </div>
            <div className="space-y-1">
              <Label>Rating</Label>
              <div className="flex h-9 items-center gap-0.5" role="radiogroup" aria-label={`Rating for review ${i + 1}`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={r.rating === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className="p-0.5"
                    onClick={() => update(rows.map((x, j) => (j === i ? { ...x, rating: n } : x)))}
                  >
                    <Star className={`size-5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`review-text-${i}`}>Review text</Label>
            <Textarea id={`review-text-${i}`} rows={2} maxLength={400} value={r.text} placeholder="Excellent deep cleaning, team was on time." onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={rows.length >= MAX_FEATURED_REVIEWS} onClick={() => update([...rows, { name: "", text: "", rating: 5 }])}>
        <Plus className="size-4" /> Add review
      </Button>
    </div>
  );
}
