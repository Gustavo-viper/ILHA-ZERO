// Cache para jogar offline
const CACHE = 'palavrario-v3';
const ARQS = ['./', './index.html', './js/palavras.js', './js/gerador.js', './js/jogo.js', './manifest.webmanifest', './icone.svg', './logo.svg'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
