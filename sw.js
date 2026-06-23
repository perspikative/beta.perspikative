const CACHE_NAME = 'perspikative-v3.0';

// Fichiers essentiels
const PRECACHE_ASSETS = [
  '/',
  '/404',
  '/actus',
  '/art-challenge',
  '/brand-guidelines',
  '/commu',
  '/contact',
  '/faq',
  '/firebase-init.js',
  '/firebase.js',
  '/help-center',
  '/login',
  '/logo.svg',
  '/mentions-legales',
  '/commu/perspikateam',
  '/politiques-de-confidentialite',
  '/portfolio',
  '/portfolio/creations',
  '/portfolio/illustrations',
  '/portfolio/projets',
  '/position-ia',
  '/rechercher',
  '/script-comments.js',
  '/script.js',
  '/style.css',
  '/fonts/Manoela-Regular.woff2',
  '/fonts/Manoela-Regular.woff',
  '/icons/accueil.svg',
  '/icons/accueil-active.svg',
  '/icons/actus.svg',
  '/icons/actus-active.svg',
  '/icons/contact.svg',
  '/icons/contact-active.svg',
  '/icons/cross.svg',
  '/icons/fermer.svg',
  '/icons/home-title1.svg',
  '/icons/home-title2.svg',
  '/icons/home-title3.svg',
  '/icons/menu.svg',
  '/icons/portfolio.svg',
  '/icons/portfolio-active.svg',
  '/icons/rechercher.svg',
  '/icons/rechercher-active.svg'
];


// -------------------- INSTALL --------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map((asset) => {
          return cache.add(asset).catch(() => {});
        })
      );
    })
  );

  self.skipWaiting();
});


// -------------------- ACTIVATE --------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );

      await clients.claim();
    })()
  );
});


// -------------------- FETCH --------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // ⚠️ only GET
  if (req.method !== 'GET') return;

  const url = req.url;

  // ❌ Ignore chrome extensions (TON BUG FIX)
  if (url.startsWith('chrome-extension://')) return;

  // ❌ Ignore non-http(s)
  if (!url.startsWith('http')) return;

  const parsedUrl = new URL(url);

  // ❌ Ignore Firebase / externals
  if (
    parsedUrl.hostname.includes('firebase') ||
    parsedUrl.hostname.includes('googleapis') ||
    parsedUrl.hostname.includes('gstatic')
  ) {
    return;
  }

  // -------------------- NAVIGATION (pages HTML) --------------------
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, clone).catch(() => {});
          });

          return res;
        })
        .catch(async () => {
          return (await caches.match(req)) || caches.match('/offline.html');
        })
    );

    return;
  }

  // -------------------- STATIC FILES (CSS/JS/IMG) --------------------
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (!res || res.status !== 200) return res;

          const clone = res.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, clone).catch(() => {});
          });

          return res;
        })
        .catch(() => null);

      if (cached) {
        fetchPromise?.catch(() => {});
        return cached;
      }

      return fetchPromise || caches.match('/offline.html');
    })
  );
});