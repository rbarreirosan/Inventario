/**
 * sw.js — Service Worker (hace la app instalable, rápida y usable sin conexión).
 *
 * Estrategia: "stale-while-revalidate" para los archivos de la app.
 *   - Abre AL INSTANTE desde lo guardado en el teléfono (rápido, incluso con
 *     datos móviles o sin señal).
 *   - Por detrás busca la versión nueva y actualiza la caché para la próxima
 *     vez. Así se actualiza sola: basta cerrar y reabrir la app.
 * Las llamadas al Apps Script (datos) NUNCA se cachean: siempre van a la red.
 *
 * IMPORTANTE: sube el número de versión (CACHE) cada vez que cambies archivos.
 */
const CACHE = 'inventario-v19';

// Archivos propios de la app (mismo origen).
const ARCHIVOS = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/api.js',
  './js/scanner.js',
  './js/pdf.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Librerías externas (CDN) que la app usa. Cachearlas evita re-descargarlas
// en cada apertura (arranque mucho más rápido en el celular).
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(async c => {
      await c.addAll(ARCHIVOS);
      // Las libs de CDN se cachean "best-effort" (si alguna falla, no importa).
      await Promise.all(LIBS.map(u => c.add(u).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(claves =>
      Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Apps Script (datos): SIEMPRE a la red, nunca caché.
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    return;
  }

  // Librerías de CDN: cache-first (ya están precargadas; si no, red y cachea).
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(event.request, copia)).catch(() => {});
        return r;
      }).catch(() => cached))
    );
    return;
  }

  // Archivos de la app: "stale-while-revalidate".
  // Devuelve lo guardado al instante y actualiza la caché por detrás.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const red = fetch(event.request).then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(event.request, copia)).catch(() => {});
        return r;
      }).catch(() => cached || caches.match('./index.html'));
      return cached || red;
    })
  );
});
