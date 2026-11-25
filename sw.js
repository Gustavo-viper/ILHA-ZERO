// Service worker: guarda todos os arquivos do jogo para funcionar sem internet.
const VERSAO = 'oficina-turbo-v2';
const ARQUIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/main.js', 'js/data.js', 'js/fisica.js', 'js/estado.js', 'js/desenho.js', 'js/som.js', 'js/ui.js', 'js/telas.js', 'js/corrida.js', 'js/carro3d.js', 'js/oficina3d.js', 'vendor/three/three.module.min.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(nomes => Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cache => cache || fetch(e.request).then(resp => {
      if (resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then(c => c.put(e.request, copia)); }
      return resp;
    }).catch(() => e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});
