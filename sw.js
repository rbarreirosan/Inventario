/**
 * sw.js — Service Worker (hace la app instalable y usable sin conexión).
 *
 * Cachea el "esqueleto" de la app (HTML/CSS/JS e íconos) para que abra
 * rápido y funcione aunque el wifi del taller falle. Los datos (catálogo
 * y conteos) se manejan aparte en localStorage desde api.js.
 *
 * IMPORTANTE: sube el número de versión (CACHE) cada vez que cambies
 * archivos, para que los teléfonos descarguen la versión nueva.
 */
const CACHE = 'inventario-v3';

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

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())
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
  const url = new URL(event.request.url);

  // Nunca cachear llamadas al Apps Script ni a librerías externas: siempre a la red.
  if (url.hostname.includes('script.google.com') || url.origin !== self.location.origin) {
    return; // deja pasar la petición normal a la red
  }

  // Estrategia "network-first" para el HTML, "cache-first" para el resto.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(event.request, copia)).catch(() => {});
      return r;
    }).catch(() => resp))
  );
});
