// AUR Leads — service worker: the app opens instantly and works without internet
// (lead data still needs internet). Bump VERSION whenever you upload new files.
const VERSION = 'aur-leads-v10';
const FILES = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/app.js', 'js/config.js', 'js/api.js', 'js/store.js', 'js/ui.js', 'js/brands.js',
  'js/pitchtext.js', 'js/quickadd.js', 'js/audit.js', 'js/outreach.js', 'js/push.js', 'js/pdf.js', 'js/handoff.js', 'js/leadactions.js', 'js/security/lock.js',
  'js/screens/home.js', 'js/screens/leads.js', 'js/screens/lead.js', 'js/screens/pitch.js',
  'js/screens/tenders.js', 'js/screens/audit.js', 'js/screens/outreach.js', 'js/screens/contacted.js', 'js/screens/alerts.js', 'js/screens/review.js', 'js/screens/settings.js',
  'vendor/jspdf.umd.min.js',
  'fonts/Montserrat-Regular.ttf', 'fonts/Montserrat-SemiBold.ttf', 'fonts/Montserrat-Bold.ttf',
  'logos/aur-studio.png', 'logos/aur-printing-studio.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('aur-leads-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// App files: internet first (updates show at once), saved copy when offline.
// Google Fonts: saved copy first. Supabase and everything else: never cached.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await Promise.race([
        fetch(req, { cache: 'no-cache' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 4000)),
      ]);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('index.html')) || Response.error();
    }
  })());
});

// ---------- phone alerts ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'AUR Leads', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'AUR Leads', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    data: { url: d.url || 'home' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || 'home';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = all.find((c) => c.url.includes(self.registration.scope));
    if (app) { app.postMessage({ type: 'open', url: target }); return app.focus(); }
    return self.clients.openWindow(`${self.registration.scope}?open=${encodeURIComponent(target)}`);
  })());
});
