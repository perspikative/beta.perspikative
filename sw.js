const CACHE_NAME = 'perspikative-v2.2';

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


// INSTALLATION
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {

        // Empêche qu'un seul fichier casse tout le précache
        await Promise.allSettled(
          PRECACHE_ASSETS.map(asset => cache.add(asset))
        );

      })
  );

  self.skipWaiting();
});


// ACTIVATION
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([

      clients.claim(),

      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )

    ])
  );
});


// FETCH
self.addEventListener('fetch', (event) => {

  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // On ne met pas Firebase/API en cache
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic')
  ) {
    return;
  }

  // Pages HTML → Network First
  if (event.request.mode === 'navigate') {

    event.respondWith(

      fetch(event.request)
        .then((response) => {

          const clone = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, clone));

          return response;

        })
        .catch(async () => {

          const cachedPage =
            await caches.match(event.request);

          if (cachedPage) {
            return cachedPage;
          }

          return caches.match('/offline.html');
        })

    );

    return;
  }

  // Images, CSS, JS → Cache First + update silencieuse
  event.respondWith(

    caches.match(event.request)
      .then((cachedResponse) => {

        const networkFetch = fetch(event.request)
          .then((response) => {

            if (response.status === 200) {

              const clone = response.clone();

              caches.open(CACHE_NAME)
                .then(cache =>
                  cache.put(event.request, clone)
                );
            }

            return response;
          });

        if (cachedResponse) {

          networkFetch.catch(() => {});

          return cachedResponse;
        }

        return networkFetch;
      })
      .catch(() => caches.match('/offline.html'))

  );
});