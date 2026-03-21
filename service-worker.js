/**
 * MAKÉ Service Worker (V9)
 *
 * Cache name includes a content hash generated at build time
 * (injected by scripts/build-hash.js).
 *
 * For zero-build / file-server use the literal __BUILD_HASH__ string is
 * kept — the SW script itself changing on each deploy is enough to bust
 * the cache automatically.
 *
 * CACHE STRATEGY
 *   • On install  → pre-cache all known app shell assets.
 *   • On activate → delete all caches except the current one.
 *   • On fetch    → cache-first for same-origin; network-only for cross-origin.
 *
 * V9: added all ui/ module paths to PRECACHE (they were missing because
 * the ui/ directory didn't exist in V8 — those files are now present).
 */

const BUILD_HASH = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'manual';
const CACHE = `make-${BUILD_HASH}`;

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Core
  './app.js',
  './core/schema.js',
  './core/state.js',
  './core/storage.js',
  // Utils
  './utils/helpers.js',
  './utils/rich-text.js',
  './utils/syntax.js',
  './utils/drag.js',
  './utils/resize.js',
  // UI  ← V9: all five files now exist
  './ui/cards.js',
  './ui/stickies.js',
  './ui/note-editor.js',
  './ui/code-editor.js',
  './ui/modals.js',
  // Features
  './features/ambient.js',
  './features/data.js',
  './features/drawer.js',
  './features/search.js',
  './features/sort-menu.js',
];

// ── Install: pre-cache app shell ──────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: prune old caches ────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first same-origin, network-only cross-origin ─
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Always network-only for Google Favicons (need live icons)
  if (url.hostname === 'www.google.com' && url.pathname.startsWith('/s2/favicons')) return;

  // Skip other cross-origin requests
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).then(res => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() =>
        new Response('Offline — Maké is not cached yet. Load once while online.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        })
      );
    })
  );
});
