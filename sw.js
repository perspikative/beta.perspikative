const CACHE_NAME = 'perspikative-v3.2'; // On change de version pour forcer la mise à jour
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/pics/meta/logo-192.png',
  '/pics/meta/logo-512.png',
  '/portfolio',
  '/contact',
  '/style.css',
  '/script.js',
  '/faq',
  '/actus',
  '/rechercher',
  '/mentions-legales',
  '/politique-de-confidentialite',
  '/position-ia',
  '/brand-guidelines',
  '/logo.svg',
  '/art-challenge',
  '/404',
  '/firebase-init.js',
  '/firebase.js',
  '/script-comments.js',
  '/portfolio/creations',
  '/portfolio/projets',
  '/portfolio/illustrations',
];

// Installation : On met tout en cache immédiatement
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activation : On nettoie les vieux caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

// STRATÉGIE CORRIGÉE : Cache d'abord, puis réseau
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Si le fichier est dans le cache, on le sert immédiatement
      if (cachedResponse) {
        return cachedResponse;
      }

      // Sinon, on va le chercher sur internet et on le met en cache pour la prochaine fois
      return fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        // Optionnel : tu pourrais renvoyer une page offline.html ici
      });
    })
  );
});