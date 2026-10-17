/* Smudge service worker: keeps Smudge on the phone so it opens offline. */
const CACHE = 'smudge-1.0.1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never installs stale files
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('smudge-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const nav = req.mode === 'navigate';
  // the app is one page; other pages in the repo (README, source) go straight to the network
  if (nav && !(url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) return;
  const key = nav ? './index.html' : req;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(key, { ignoreSearch: true });
    // serve the saved copy right away, and quietly refresh it for next time
    const fresh = nav ? new Request('./index.html', { cache: 'no-cache' }) : new Request(req, { cache: 'no-cache' });
    const net = fetch(fresh).then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    const fallback = nav ? await cache.match('./index.html') : null;
    return fallback || new Response('', { status: 504, statusText: 'Offline' });
  })());
});
