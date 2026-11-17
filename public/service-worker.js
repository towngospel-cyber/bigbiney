/* Bigbiney Printing Press — service worker.
   Caches the app shell so it opens instantly and shows a friendly page offline.
   Business data (Supabase) is NEVER cached, so numbers are always live. */
const CACHE = 'bigbiney-v1';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return; // Supabase, SMS API etc. go straight to the network
  if (req.mode === 'navigate') {                                  // pages: network first, cached shell when offline
    e.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }
  e.respondWith(                                                  // static files: cache first, then update in background
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net;
    })
  );
});
