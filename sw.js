// Nightfall Settlement service worker: caches the game so it starts offline and loads fast after the first visit.
// Bump VERSION when you publish a new build so players pick it up (assets are served cache-first, refreshed in the background).
const VERSION = 'nf-v3';
const SHELL = ['./', 'index.html', 'manifest.json', 'css/style.css', 'vendor/three.min.js', 'vendor/GLTFLoader.js', 'vendor/SkeletonUtils.js', 'js/config.js', 'js/audio.js', 'js/rig.js', 'js/game.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url), cdn = /(^|\.)(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)$/.test(u.hostname);
  if (u.origin !== location.origin && !cdn) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req);
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
