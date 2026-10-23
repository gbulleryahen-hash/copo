// COPO — service worker : réseau d'abord (les mises à jour arrivent tout de suite), cache en secours hors ligne.
const CACHE = 'copo-v1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'lib/clipper.js', 'lib/d3-delaunay.js', 'lib/jspdf.umd.min.js', 'lib/opentype.min.js',
  'lib/fonts/SourceSans3.ttf', 'lib/fonts/SourceSans3-Italic.ttf', 'lib/fonts/JetBrainsMono.ttf', 'lib/fonts/BarlowCondensed-Bold.ttf', 'lib/fonts/BarlowCondensed-SemiBold.ttf',
  'img/icon-192.png', 'img/icon-512.png', 'img/doc-copo-256.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => { }).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
