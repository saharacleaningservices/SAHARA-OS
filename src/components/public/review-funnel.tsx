"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, ClipboardCopy, ExternalLink, Star } from "lucide-react";
import { pickReviewChips, type ReviewService } from "@/lib/review-chips";
import { submitPrivateFeedback } from "@/server/actions/review-feedback";
import { reviewRoute } from "@/lib/review-route";

/**
 * Smart review funnel. Layout model: BOX MODEL — one fixed 420 px card (stars, chips, one primary button) centred on a blue page,
 * identical on every phone. 4–5 chips per visit, a new shuffle each browser session; tapping a chip copies it and unlocks
 * "Paste & Post on Google", which opens the Google review dialog in a new tab.
 *
 * Review redirector (owner 2026-10-26): the customer first taps a star rating. 4–5★ → the Google flow above.
 * 1–3★ → a private feedback box that goes straight to the CRM (Review row + team alert) so the issue is fixed fast.
 * The Google link stays visible on that screen too — Google's review policy forbids blocking or filtering who may
 * post (review gating can get reviews removed), so we route, never prevent.
 */
export function ReviewFunnel({ name, serviceKey, serviceLabel, reviewUrl, token = null, code = null }: { name: string | null; serviceKey: ReviewService; serviceLabel: string | null; reviewUrl: string; token?: string | null; code?: string | null }) {
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [fbState, setFbState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [fbError, setFbError] = useState<string | null>(null);
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

  async function sendFeedback() {
    if (!rating) return;
    setFbState("sending");
    setFbError(null);
    const r = await submitPrivateFeedback({ rating, comment: feedback, t: token, c: code }).catch(() => ({ ok: false as const, error: "Could not send — please try again." }));
    if (r.ok) {
      setFbState("sent");
      (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({ event: "review_private_feedback", rating });
    } else {
      setFbState("error");
      setFbError(r.error ?? "Could not send — please try again.");
    }
  }

  const route = reviewRoute(rating);
  const shell = (children: ReactNode) => (
    <main className="theme-sahara-blue flex min-h-[100dvh] items-center justify-center bg-[#eef2fb] px-4 py-6">
      <section className="w-full max-w-[420px] space-y-4 rounded-3xl bg-white p-5 text-[#0f172a] shadow-lg" aria-label="Review Sahara Cleaning Services">{children}</section>
    </main>
  );

  if (route === "ASK") {
    return shell(
      <header className="space-y-3 text-center">
        <h1 className="text-xl font-extrabold text-[#1E40AF]">{name ? `Thank you, ${name}!` : "Thank you for choosing Sahara!"}</h1>
        <p className="text-sm text-[#475569]">{serviceLabel ? `How was your ${serviceLabel} service?` : "How was your service?"} Tap a star.</p>
        <div className="flex justify-center gap-1.5" role="radiogroup" aria-label="Rate your service from 1 to 5 stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={false} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => { setRating(n); (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({ event: "review_rating", rating: n }); }} className="rounded-xl p-1.5 text-amber-400 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-[#1E40AF]">
              <Star className="size-10 fill-current" />
            </button>
          ))}
        </div>
      </header>,
    );
  }

  if (route === "PRIVATE") {
    return shell(
      fbState === "sent" ? (
        <div className="space-y-2 text-center" role="status">
          <h1 className="text-xl font-extrabold text-[#1E40AF]">Thank you — we're on it.</h1>
          <p className="text-sm text-[#475569]">Your feedback went straight to our operations manager. We will call you today to make it right.</p>
        </div>
      ) : (
        <>
          <header className="space-y-1 text-center">
            <div className="flex justify-center gap-0.5 text-amber-400" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => <Star key={i} className={`size-6 ${i < (rating ?? 0) ? "fill-current" : "fill-none text-slate-300"}`} />)}
            </div>
            <h1 className="text-xl font-extrabold text-[#1E40AF]">We're sorry we missed the mark</h1>
            <p className="text-sm text-[#475569]">Tell us what went wrong — it goes directly to our management team, not public.</p>
          </header>
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} maxLength={1000} placeholder="What should we fix?" aria-label="Your feedback" className="w-full rounded-2xl border-2 border-[#1E40AF]/20 p-3 text-sm focus:border-[#1E40AF] focus:outline-none" />
          {fbError ? <p className="text-xs font-semibold text-red-600" role="alert">{fbError}</p> : null}
          <button type="button" disabled={fbState === "sending" || feedback.trim().length < 3} onClick={() => void sendFeedback()} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#1E40AF] text-sm font-extrabold text-white disabled:opacity-40">
            {fbState === "sending" ? "Sending…" : "Send to Sahara management"}
          </button>
          <div className="flex items-center justify-between text-[11px] text-[#475569]">
            <button type="button" onClick={() => setRating(null)} className="underline">Change rating</button>
            <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className="underline">Post a public Google review instead</a>
          </div>
        </>
      ),
    );
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
