const CACHE_NAME = 'biblio-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET, chrome-extension, supabase API, auth
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/')) return;
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/auth/')) return;

  // Network-first pour le HTML (pour avoir les MAJ)
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, copy));
        return resp;
      }).catch(() => caches.match(request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first pour le reste (CDN, images, fonts)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        if (resp.ok && (url.protocol === 'https:')) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, copy));
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
