/* JARVIS · service worker: primero la red, y si no hay, lo guardado (para que abra sin internet) */
const CACHE = 'jarvis-v13';
const BASE = ['./', 'index.html', 'taller-vr.html', 'css/jarvis.css', 'vendor/qrcode.js', 'vendor/jsQR.js', 'img/icono.svg', 'manifest.webmanifest',
  'js/app.js', 'js/vr.js', 'js/datos.js', 'js/personalidades.js', 'js/filtro.js', 'js/config.js', 'js/api.js', 'js/estado.js', 'js/cerebro.js', 'js/misiones.js', 'js/guias.js', 'js/ui.js',
  'js/nucleo.js', 'js/ambiente.js', 'js/voz.js', 'js/sonidos.js', 'js/qr.js', 'js/camara.js', 'js/codigo_vr.js', 'js/taller_vr_datos.js', 'js/estaciones_datos.js', 'guia.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(BASE.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/api/') || url.pathname.endsWith('.mp4')) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok && (url.origin === location.origin || url.hostname.includes('fonts.g'))) {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
      }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
