/* ═══════════════════════════════════════════════════════════
   SERVICE WORKER — le mode hors-ligne
   ───────────────────────────────────────────────────────────
   Un "service worker" est un petit programme que le navigateur
   garde en réserve, séparé de la page. Il s'interpose entre
   l'appli et le réseau : quand la page demande un fichier, il
   peut le servir depuis sa propre copie plutôt que d'aller le
   chercher sur internet. Résultat : l'appli s'ouvre même dans
   le métro, sans connexion.

   C'est aussi ce fichier qui recevra les notifications push au
   palier 2 : c'est lui qui tourne quand l'appli est fermée.

   IMPORTANT : à chaque modification du code, change le numéro
   de version ci-dessous, sinon le téléphone continuera à
   servir l'ancienne copie.
   ═══════════════════════════════════════════════════════════ */

const NOM_CACHE = 'vocab-v1';

const FICHIERS_A_METTRE_EN_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/stockage.js',
  './js/revision.js',
  './js/app.js',
  './manifest.json'
];

// 1. INSTALLATION : on télécharge et on range tous les fichiers.
self.addEventListener('install', function (evenement) {
  evenement.waitUntil(
    caches.open(NOM_CACHE).then(function (cache) {
      return cache.addAll(FICHIERS_A_METTRE_EN_CACHE);
    })
  );
  self.skipWaiting(); // la nouvelle version prend la main tout de suite
});

// 2. ACTIVATION : on fait le ménage des anciennes versions du cache.
self.addEventListener('activate', function (evenement) {
  evenement.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(
        noms.filter(function (nom) { return nom !== NOM_CACHE; })
            .map(function (nom) { return caches.delete(nom); })
      );
    })
  );
  self.clients.claim();
});

// 3. INTERCEPTION : pour chaque fichier demandé, on sert la copie
//    locale si on l'a, sinon on va la chercher sur le réseau.
self.addEventListener('fetch', function (evenement) {
  if (evenement.request.method !== 'GET') return;

  evenement.respondWith(
    caches.match(evenement.request).then(function (copieLocale) {
      return copieLocale || fetch(evenement.request);
    })
  );
});
