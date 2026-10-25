"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardCopy, ExternalLink, Star } from "lucide-react";
import { pickReviewChips, type ReviewService } from "@/lib/review-chips";

/**
 * Smart review funnel. Layout model: BOX MODEL — one fixed 420 px card (stars, chips, one primary button) centred on a blue page,
 * identical on every phone. 4–5 chips per visit, a new shuffle each browser session; tapping a chip copies it and unlocks
 * "Paste & Post on Google", which opens the Google review dialog in a new tab.
 */
export function ReviewFunnel({ name, serviceKey, serviceLabel, reviewUrl }: { name: string | null; serviceKey: ReviewService; serviceLabel: string | null; reviewUrl: string }) {
  const [chips, setChips] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    // The seed lives in sessionStorage: a refresh keeps the same set, a new session (new visit) rotates to another one.
    let seed = Date.now() % 2147483647;
    try {
      const key = `sahara_review_seed_${serviceKey}`;
      const saved = Number(sessionStorage.getItem(key));
      if (saved) seed = saved;
      else sessionStorage.setItem(key, String(seed));
    } catch {
      // storage blocked — a one-off random set is fine
    }
    setChips(pickReviewChips(serviceKey, seed));
    (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({ event: "review_funnel_view", service: serviceKey });
  }, [serviceKey]);

  async function pick(text: string) {
    setPicked(text);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setCopyFailed(true); // clipboard blocked — the text stays on screen to copy by hand
    }
  }

  function post() {
    (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({ event: "review_funnel_post", service: serviceKey });
    window.open(reviewUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="theme-sahara-blue flex min-h-[100dvh] items-center justify-center bg-[#eef2fb] px-4 py-6">
      <section className="w-full max-w-[420px] space-y-4 rounded-3xl bg-white p-5 text-[#0f172a] shadow-lg" aria-label="Review Sahara Cleaning Services">
        <header className="space-y-1 text-center">
          <div className="flex justify-center gap-0.5 text-amber-400" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="size-6 fill-current" />)}
          </div>
          <h1 className="text-xl font-extrabold text-[#1E40AF]">{name ? `Thank you, ${name}!` : "Thank you for choosing Sahara!"}</h1>
          <p className="text-sm text-[#475569]">
            {serviceLabel ? `How was your ${serviceLabel} service? ` : ""}Tap the line that sounds most like your experience — we copy it for you, then paste it on Google.
          </p>
        </header>

        <ul className="space-y-2" aria-label="Review suggestions">
          {chips.map((c) => {
            const on = picked === c;
            return (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => void pick(c)}
                  aria-pressed={on}
                  className={`flex w-full items-start gap-2 rounded-2xl border-2 p-3 text-left text-sm leading-snug transition ${on ? "border-[#1E40AF] bg-[#1E40AF]/5 font-semibold" : "border-[#1E40AF]/15 bg-white hover:border-[#1E40AF]/50"}`}
                >
                  <span className="mt-0.5 shrink-0 text-[#1E40AF]">{on ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}</span>
                  <span>{c}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {picked ? (
          <p className="rounded-xl bg-emerald-50 p-2.5 text-center text-xs font-semibold text-emerald-700" role="status">
            {copyFailed ? "Couldn't copy automatically — press and hold the line above to copy it." : "Copied! Now tap the button and paste it into your Google review."}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!picked}
          onClick={post}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E40AF] text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ExternalLink className="size-4" /> Paste &amp; Post on Google
        </button>
        <p className="text-center text-[11px] text-[#475569]">Feel free to edit the words — your own experience matters most.</p>
      </section>
    </main>
  );
}
