/* Service worker de MediTime.
   Estrategia "red primero": siempre intenta traer la versión nueva y usa la copia
   guardada solo si no hay conexión. Así las actualizaciones nunca quedan trabadas en caché. */
const CACHE = 'meditime-v1';
const ASSETS = [
  './', 'index.html', 'manifest.json', 'css/styles.css',
  'js/storage.js', 'js/medication.js', 'js/timer.js', 'js/app.js',
  'assets/logo.svg', 'assets/favicon.svg', 'assets/bg-leaves.svg',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-180.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
  );
});
