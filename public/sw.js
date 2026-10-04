/* Sahara OS — service worker for Web Push notifications. */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Sahara OS", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Sahara OS";
  // Staff App events use the distinctive "Sa-ha-ra" vibration rhythm on
  // Android. Browsers don't allow a custom notification SOUND for web push
  // (Android/iOS use the system sound), so when the Staff App is open in the
  // foreground we also post a message and the page plays the Sahara chime.
  const SAHARA_RHYTHM = [90, 60, 90, 60, 260];
  const options = {
    body: data.body || "",
    icon: data.staffApp ? "/brand/staff-icon-192.png" : "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "sahara-os",
    renotify: true,
    requireInteraction: !!data.critical,
    vibrate: data.staffApp ? (data.critical ? SAHARA_RHYTHM.concat([200], SAHARA_RHYTHM) : SAHARA_RHYTHM) : data.critical ? [200, 100, 200, 100, 400] : [120, 60, 120],
    data: { href: data.href || (data.staffApp ? "/my" : "/dashboard"), critical: !!data.critical },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      data.staffApp
        ? self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
            for (const c of list) c.postMessage({ type: "sahara-push", critical: !!data.critical });
          })
        : null,
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/dashboard";
  // Opens the exact record (e.g. /my/day/2026-10-04#adv-…).
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(href);
          return;
        }
      }
      return self.clients.openWindow(href);
    })
  );
});
