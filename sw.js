// Nightfall Settlement service worker: caches the game so it starts offline and loads fast after the first visit.
// Bump VERSION when you publish a new build so players pick it up (network first, cache when offline).
const VERSION = 'nf-v86';
const SHELL = ['./', 'index.html', 'manifest.json', 'css/style.css', 'vendor/three.min.js', 'vendor/GLTFLoader.js', 'vendor/SkeletonUtils.js', 'js/config.js', 'js/audio.js', 'js/anims.js', 'js/models.js', 'js/structures.js', 'js/rig.js', 'js/game.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon.svg'];
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
    return net.then(r => r || hit);                        // 네트워크 우선(최신 파일), 오프라인이면 캐시 - 파일이 서로 다른 버전으로 섞이는 일을 막는다
  }));
});
