// Network-first for everything on this origin: the board changes on every publish, and a
// stale shell is worse than a slow one. The cache is only the offline fallback.
// SHELL is stamped per publish by fm.reports.site.publish_site so old caches are purged.
const SHELL = "archer-shell-20260926161815";
const ASSETS = ["./", "./index.html", "./app.js", "./manifest.webmanifest", "./icon.svg", "./icon-180.png", "./icon-192.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-store" })
      .then((r) => { const copy = r.clone(); caches.open(SHELL).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

// iPhone notifications (ADR-0038): the server sends {title, body, url, tag}.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Archer", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Archer", {
    body: d.body || "", tag: d.tag || undefined, data: { url: d.url || "./" },
    icon: "./icon-192.png", badge: "./icon-192.png",
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
    for (const w of wins) { if ("focus" in w) { w.postMessage({ go: target }); return w.focus(); } }
    return self.clients.openWindow(target);
  }));
});
