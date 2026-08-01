/* POTA — servis çalışanı
   İki iş yapıyor:
   1. Oyunu çevrimdışı çalıştırmak (CDN dosyaları dahil)
   2. Ana ekrana eklenince gerçek uygulama gibi davranmasını sağlamak

   SÜRÜM'ü her güncellemede artır, yoksa eski önbellek yapışır kalır. */
const SURUM = 'pota-v1.0.1';

const YEREL = [
  './', './index.html', './boot.js', './game.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'
];

// CDN dosyaları: opak yanıt olarak saklanır (CORS gerektirmez)
const UZAK = [
  'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SURUM);
    await c.addAll(YEREL);
    // Uzak dosyalar başarısız olursa kurulumu düşürme
    await Promise.all(UZAK.map(u =>
      c.add(new Request(u, { mode: 'no-cors' })).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const adlar = await caches.keys();
    await Promise.all(adlar.filter(a => a !== SURUM).map(a => caches.delete(a)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const bulunan = await caches.match(e.request);
    if (bulunan) {
      // arka planda tazele, ama beklemeden eskisini ver
      fetch(e.request).then(y => {
        if (y && (y.ok || y.type === 'opaque'))
          caches.open(SURUM).then(c => c.put(e.request, y));
      }).catch(() => {});
      return bulunan;
    }
    try {
      const y = await fetch(e.request);
      if (y && (y.ok || y.type === 'opaque'))
        caches.open(SURUM).then(c => c.put(e.request, y.clone()));
      return y;
    } catch (err) {
      // çevrimdışı ve önbellekte yok
      return caches.match('./index.html');
    }
  })());
});
