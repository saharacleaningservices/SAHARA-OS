"use client";

import { useEffect, useRef } from "react";
import type { FestivalKind } from "@/lib/festival-calendar";

/**
 * Festival Engine canvas (2026-11-01). One light <canvas> that fills its (relatively positioned) parent — mount it in the Hero,
 * a middle section and the footer with a different `intensity`. Performance rules:
 *   • nothing is drawn for visitors who prefer reduced motion (the announcement widget still shows),
 *   • starts after the page is idle (never competes with LCP), pauses when scrolled off-screen or the tab is hidden,
 *   • device-pixel-ratio capped at 1.5, particle count capped, GPU-composited layer (transform/opacity only on the element),
 *   • pointer-events: none — taps pass straight through to the page. Interactive effects listen on the parent instead.
 */
export type FestivalZone = "hero" | "middle" | "footer";

type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number; kind: string; rot?: number; vr?: number; sat?: number };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function FestivalEffects({ kind, zone = "hero", intensity }: { kind: FestivalKind; zone?: FestivalZone; intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const level = intensity ?? (zone === "hero" ? 1 : zone === "middle" ? 0.5 : 0.65);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host || kind === "badge") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, raf = 0, last = 0, visible = true, started = false, stopped = false, spawnAcc = 0, burstAcc = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const parts: P[] = [];
    const small = () => w < 640;
    const cap = () => Math.round((small() ? 70 : 140) * level);

    const resize = () => {
      const r = host.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const burst = (x: number, y: number, n: number, hue: number) => {
      for (let i = 0; i < n; i++) {
        const a = rnd(0, Math.PI * 2), s = rnd(0.6, 3.2);
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rnd(0.9, 1.6), size: rnd(1, 2.2), hue: hue + rnd(-14, 14), kind: "spark" });
      }
    };
    const confetti = (x: number, y: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = rnd(-Math.PI, 0), s = rnd(2, 6);
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rnd(1.6, 2.6), size: rnd(3, 6), hue: Math.floor(rnd(0, 360)), kind: "confetti", rot: rnd(0, 6), vr: rnd(-8, 8) });
      }
    };

    const spawn = (dt: number) => {
      const max = cap();
      if (parts.length > max * 2) return;
      spawnAcc += dt;
      burstAcc += dt;
      if (kind === "diwali") {
        // Sky rockets: launch every ~1.6s (hero) and burst at the top; glowing diyas drift up from the bottom.
        if (burstAcc > 1.6 / level) {
          burstAcc = 0;
          parts.push({ x: rnd(w * 0.15, w * 0.85), y: h, vx: rnd(-0.3, 0.3), vy: -rnd(h * 0.55, h * 0.85) / 1.1, life: 0, max: 1.1, size: 2, hue: rnd(20, 50), kind: "rocket" });
        }
        if (spawnAcc > 0.35 / level) {
          spawnAcc = 0;
          parts.push({ x: rnd(0, w), y: h + 6, vx: rnd(-0.1, 0.1), vy: -rnd(0.25, 0.6), life: 0, max: rnd(5, 8), size: rnd(3, 6), hue: rnd(28, 44), kind: "diya" });
        }
      } else if (kind === "ganpati") {
        if (spawnAcc > 0.12 / level) {
          spawnAcc = 0;
          const modak = Math.random() < 0.18;
          parts.push({ x: rnd(0, w), y: -10, vx: rnd(-0.4, 0.4), vy: rnd(0.5, 1.3), life: 0, max: rnd(7, 11), size: modak ? rnd(5, 7) : rnd(4, 8), hue: modak ? 42 : rnd(300, 350) + (Math.random() < 0.4 ? -280 : 0), kind: modak ? "modak" : "petal", rot: rnd(0, 6), vr: rnd(-1.5, 1.5) });
        }
      } else if (kind === "eid") {
        if (spawnAcc > 0.09 / level) {
          spawnAcc = 0;
          parts.push({ x: rnd(0, w), y: rnd(0, h), vx: 0, vy: rnd(-0.05, 0.05), life: 0, max: rnd(1.2, 2.4), size: rnd(1, 2.6), hue: 46, kind: "twinkle" });
        }
      } else if (kind === "christmas-newyear") {
        if (spawnAcc > 0.1 / level) {
          spawnAcc = 0;
          parts.push({ x: rnd(0, w), y: -6, vx: rnd(-0.3, 0.3), vy: rnd(0.4, 1.1), life: 0, max: rnd(8, 12), size: rnd(1.2, 3.4), hue: 210, kind: "snow" });
        }
        if (burstAcc > 4.5 / level) {
          burstAcc = 0;
          confetti(rnd(w * 0.2, w * 0.8), h * 0.9, small() ? 14 : 28);
        }
      }
    };

    const step = (dt: number) => {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        if (p.rot !== undefined && p.vr) p.rot += p.vr * dt;
        if (p.kind === "spark") { p.vy += 0.045 * dt * 60; p.vx *= 0.985; }
        else if (p.kind === "confetti") { p.vy += 0.12 * dt * 60; p.vx *= 0.99; }
        else if (p.kind === "rocket") {
          p.vy *= 0.985;
          if (p.life >= p.max || p.vy > -0.6) { burst(p.x, p.y, small() ? 22 : 38, p.hue); parts.splice(i, 1); continue; }
        } else if (p.kind === "petal" || p.kind === "modak" || p.kind === "snow") p.x += Math.sin(p.life * 1.6 + p.size) * 0.35;
        if (p.life > p.max || p.y > h + 20 || p.y < -40) parts.splice(i, 1);
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      if (kind === "eid") drawCrescent();
      for (const p of parts) {
        const t = p.life / p.max;
        const fade = p.kind === "diya" ? Math.sin(Math.min(1, t) * Math.PI) : Math.max(0, 1 - t * t);
        ctx.globalAlpha = Math.max(0, Math.min(1, fade));
        if (p.kind === "spark" || p.kind === "rocket") {
          ctx.fillStyle = `hsl(${p.hue} 100% ${p.kind === "rocket" ? 80 : 62}%)`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill();
        } else if (p.kind === "diya") {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.2);
          g.addColorStop(0, `hsla(${p.hue} 100% 70% / .95)`); g.addColorStop(1, `hsla(${p.hue} 100% 55% / 0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3.2, 0, 6.283); ctx.fill();
        } else if (p.kind === "petal") {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot ?? 0);
          ctx.fillStyle = `hsl(${(p.hue + 360) % 360} 85% 62%)`;
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, 6.283); ctx.fill(); ctx.restore();
        } else if (p.kind === "modak") {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rot ?? 0) * 0.3);
          ctx.fillStyle = "hsl(40 90% 62%)";
          ctx.beginPath(); ctx.moveTo(0, -p.size * 1.3); ctx.quadraticCurveTo(p.size, p.size * 0.2, 0, p.size); ctx.quadraticCurveTo(-p.size, p.size * 0.2, 0, -p.size * 1.3); ctx.fill(); ctx.restore();
        } else if (p.kind === "twinkle") {
          ctx.fillStyle = `hsl(${p.hue} 100% 70%)`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill();
        } else if (p.kind === "snow") {
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill();
        } else if (p.kind === "confetti") {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot ?? 0);
          ctx.fillStyle = `hsl(${p.hue} 85% 60%)`; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    };

    function drawCrescent() {
      const c = ctx as CanvasRenderingContext2D;
      const r = Math.min(w, h) * (small() ? 0.16 : 0.12) * Math.max(0.7, level);
      const cx = w - r * 2.4, cy = r * 2.1;
      const g = c.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 3);
      g.addColorStop(0, "rgba(250,204,21,.35)"); g.addColorStop(1, "rgba(250,204,21,0)");
      c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r * 3, 0, 6.283); c.fill();
      c.fillStyle = "#fde68a"; c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.fill();
      c.globalCompositeOperation = "destination-out"; c.beginPath(); c.arc(cx + r * 0.45, cy - r * 0.15, r * 0.88, 0, 6.283); c.fill();
      c.globalCompositeOperation = "source-over";
    }

    const frame = (ts: number) => {
      if (stopped) return;
      raf = 0;
      if (!visible || document.hidden) { last = 0; return; }
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      spawn(dt); step(dt); draw();
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (started && !raf && visible && !stopped) raf = requestAnimationFrame(frame); };

    // Interactive: a tap / click on the section launches a rocket burst (Diwali), a sparkler trail (Eid) or a confetti pop (Christmas / New Year).
    // Listens on the window (the canvas itself is pointer-events:none so taps still reach the page) and only reacts inside this section.
    const onPointer = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom || !visible) return;
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (kind === "diwali") burst(x, y, small() ? 20 : 34, rnd(15, 55));
      else if (kind === "eid") for (let i = 0; i < 14; i++) parts.push({ x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: rnd(-0.6, 0.6), vy: rnd(-0.6, 0.2), life: 0, max: rnd(0.8, 1.5), size: rnd(1, 2.6), hue: 46, kind: "twinkle" });
      else if (kind === "christmas-newyear") confetti(x, y, small() ? 12 : 22);
      kick();
    };

    const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; if (visible) kick(); }, { threshold: 0.01 });
    const ro = new ResizeObserver(resize);
    const onVis = () => { if (!document.hidden) kick(); };
    const start = () => { if (stopped) return; resize(); started = true; io.observe(host); ro.observe(host); window.addEventListener("pointerdown", onPointer, { passive: true }); document.addEventListener("visibilitychange", onVis); kick(); };

    // Wait until the browser is idle so the effect never competes with the first paint.
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(start, { timeout: 2500 }) : window.setTimeout(start, 1200);

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (idle) (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle as number); else clearTimeout(handle as number);
      io.disconnect(); ro.disconnect();
      window.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [kind, level]);

  if (kind === "badge") return null;
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full [transform:translateZ(0)]" />;
}
