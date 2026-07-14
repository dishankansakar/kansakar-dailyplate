// ── Daily Plate Service Worker ──────────────────────────────────────────────
// CACHE_VERSION is updated on every build so the browser installs fresh SW.
// Strategy: network-first (always get latest when online, cache as fallback).
const CACHE_VERSION = 'daily-plate-v1.2-20260714';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './ingredients.js',
  './enhancements.js',
  './v12.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  // Pre-cache on install, then take over immediately — don't wait for old tabs to close.
  e.waitUntil(
    caches.open(CACHE_VERSION).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete any old cache versions.
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  // Network-first: always try to get a fresh copy; cache is the offline fallback.
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if(res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
