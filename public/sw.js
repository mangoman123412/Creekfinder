// CreekFinder service worker: makes the installed web app open and work with no signal.
//  - app files: network-first when online (so updates arrive), cached copy when offline
//  - map tiles/styles/fonts: cache-first with a size cap, so areas you've viewed work offline
const APP = 'cf-app-v1';
const TILES = 'cf-tiles-v1';
const MAX_TILES = 3000;
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/vendor/maplibre-gl.js', '/vendor/maplibre-gl.css', '/vendor/sql-wasm.js', '/vendor/sql-wasm.wasm'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![APP, TILES].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

const MAP_HOSTS = ['api.maptiler.com', 'tiles.openfreemap.org', 'tiles.stadiamaps.com'];

async function trim(name, max) {
  const c = await caches.open(name); const keys = await c.keys();
  if (keys.length > max) for (const k of keys.slice(0, keys.length - max)) await c.delete(k);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (MAP_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      try { const res = await fetch(req); if (res.ok) { c.put(req, res.clone()); trim(TILES, MAX_TILES); } return res; } catch { return hit || Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return; // never cache API calls (Supabase, weather, ...)
  e.respondWith((async () => {
    const c = await caches.open(APP);
    try {
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    } catch {
      return (await c.match(req)) || (req.mode === 'navigate' ? await c.match('/') : undefined) || Response.error();
    }
  })());
});
