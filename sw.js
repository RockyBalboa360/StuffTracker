// Service Worker: Offline-Betrieb + kontrolliertes Update.
// Bei jeder Änderung an App-Dateien VERSION erhöhen (siehe tools/bump.mjs), sonst bleibt der alte Cache aktiv.
const VERSION = '0.3.0';
const CACHE = `stufftracker-${VERSION}`;
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/ui.js', 'js/i18n.js', 'js/sun.js', 'js/photo.js',
  'js/views/home.js', 'js/views/stock.js', 'js/views/item.js', 'js/views/transport.js', 'js/views/settings.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('stufftracker-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit
      || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
