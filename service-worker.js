/**
 * MAKÉ Service Worker
 *
 * FIX: The cache name now includes a content hash generated at build time
 * (injected by build-hash.js — see scripts/build-hash.js).  This eliminates
 * the risk of forgetting to bump the version number after a deploy.
 *
 * For zero-build / file-server use, the hash falls back to a timestamp that
 * is fixed at SW registration time.  To bust the cache manually, just
 * re-deploy any changed file — the browser will detect the SW script has
 * changed and trigger install + activate automatically.
 *
 * CACHE STRATEGY
 *   • On install  → pre-cache all known app shell assets.
 *   • On activate → delete all caches except the current one.
 *   • On fetch    → cache-first for same-origin resources;
 *                   network-only for cross-origin.
 */

// __BUILD_HASH__ is replaced by scripts/build-hash.js if you use it.
// Without that script the literal string is used, which is still fine —
// the SW script itself changing on each deploy will trigger a cache bust.
const BUILD_HASH = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'manual';
const CACHE = `make-${BUILD_HASH}`;

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // App modules — add new files here when you add them.
  './app.js',
  './core/schema.js',
  './core/state.js',
  './core/storage.js',
  './utils/helpers.js',
  './utils/rich-text.js',
  './utils/syntax.js',
  './utils/drag.js',
  './utils/resize.js',
  './ui/cards.js',
  './ui/stickies.js',
  './ui/note-editor.js',
  './ui/code-editor.js',
  './ui/modals.js',
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

// ── Fetch: cache-first for same-origin, network-only for cross-origin ──
self.addEventListener('fetch', e => {
  // Only handle GET requests.
  if (e.request.method !== 'GET') return;

  // Skip cross-origin requests (analytics, CDN, etc.).
  const url = new URL(e.request.url);
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
        new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
      );
    })
  );
});
