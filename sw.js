// Service Worker: speichert alle App-Dateien, damit die App komplett offline läuft.
// Bei jeder Änderung an den App-Dateien die Versionsnummer erhöhen.
const CACHE = 'mamas-kueche-v1';
const DATEIEN = [
  './',
  './index.html',
  './styles.css',
  './js/app.js',
  './js/db.js',
  './js/parser.js',
  './js/hilfe.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then((r) => r || fetch(req))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req).then((res) => {
      if (res.ok) {
        const kopie = res.clone();
        caches.open(CACHE).then((c) => c.put(req, kopie));
      }
      return res;
    }))
  );
});
