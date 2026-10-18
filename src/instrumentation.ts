// Next.js server start hook. Starts the in-process ops-reminder scheduler
// (src/server/ops-reminders.ts) — every 60 s on the long-lived Node server, so
// reminders don't depend on anyone having a browser tab open. Runs in
// production by default; set OPS_REMINDERS_SCHEDULER=off to disable, or =on to
// run it under `npm run dev` too.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const flag = process.env.OPS_REMINDERS_SCHEDULER;
  if (flag === "off" || (process.env.NODE_ENV !== "production" && flag !== "on")) return;
  const { runOpsReminderSweep } = await import("@/server/ops-reminders");
  const { maybeBackupStaleAlert } = await import("@/server/backup-health");
  const { maybeHealthAlert } = await import("@/server/health");
  const tick = () => {
    void runOpsReminderSweep().catch((e) => console.error("[ops-reminders] sweep failed:", e));
    void maybeBackupStaleAlert(); // never throws; one alert/day while the last verified backup is >26 h old
    void maybeHealthAlert(); // never throws; one alert per 6 h when memory / DB / event loop turn unhealthy
  };
  setTimeout(tick, 30_000); // let the server finish booting first
  setInterval(tick, 60_000).unref?.();
  console.log("[ops-reminders] scheduler started (every 60 s)");
}
