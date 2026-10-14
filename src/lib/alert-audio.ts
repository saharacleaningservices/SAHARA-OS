// Shared browser alert audio for the notification bell and the new-inquiry popup.
// Audio is never started without a user gesture: unlockAudio() must be called from a click/key handler;
// playChime() returns false (and stays silent) while the browser still blocks audio.

let sharedCtx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  try {
    if (!sharedCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      sharedCtx = new Ctx();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

/** Must be called from a user gesture. Resolves true once the browser lets us play audio. */
export async function unlockAudio(): Promise<boolean> {
  const ctx = audioCtx();
  if (!ctx) return false;
  try {
    await ctx.resume();
  } catch {
    /* blocked */
  }
  return ctx.state === "running";
}

export const audioUnlocked = () => sharedCtx?.state === "running";

/** Synthesised alert tones — no audio asset needed. Returns false when the browser has not allowed audio yet. */
export function playChime(critical: boolean): boolean {
  try {
    const ctx = audioCtx();
    if (!ctx || ctx.state !== "running") return false;
    const now = ctx.currentTime;
    const seq = critical ? [880, 660, 880, 660, 990] : [1318, 988]; // E6 → B5, WhatsApp-ish two-note
    seq.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = critical ? "square" : "sine";
      osc.frequency.value = freq;
      const t = now + i * (critical ? 0.16 : 0.12);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(critical ? 0.5 : 0.32, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (critical ? 0.16 : 0.22));
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    return true;
  } catch {
    return false;
  }
}
