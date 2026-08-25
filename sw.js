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

   STRATÉGIE CHOISIE : « réseau d'abord, cache en secours ».
   Quand il y a du réseau, on va toujours chercher la dernière
   version en ligne — donc une mise à jour publiée sur GitHub
   arrive sur le téléphone au prochain lancement, sans rien
   faire. Quand il n'y a pas de réseau, on sert la copie gardée
   en réserve, et l'appli fonctionne quand même.

   L'inverse (« cache d'abord ») serait un peu plus rapide, mais
   le téléphone resterait bloqué sur une vieille version tant
   qu'on n'aurait pas pensé à changer le numéro ci-dessous.
   Pendant qu'on développe, la fraîcheur compte plus que les
   quelques millisecondes gagnées.

   Note importante : ce fichier ne touche JAMAIS aux mots
   enregistrés. Il ne gère que les fichiers de l'application.
   ═══════════════════════════════════════════════════════════ */

const NOM_CACHE = 'vocapp-v3';

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

// 3. INTERCEPTION : pour chaque fichier demandé, on essaie le réseau,
//    et on retombe sur la copie locale si la connexion manque.
self.addEventListener('fetch', function (evenement) {
  if (evenement.request.method !== 'GET') return;

  // On ne s'occupe que des fichiers de l'appli, pas des sites extérieurs.
  if (new URL(evenement.request.url).origin !== location.origin) return;

  evenement.respondWith(
    fetch(evenement.request)
      .then(function (reponse) {
        // Version fraîche reçue : on met la réserve à jour au passage.
        // clone() est obligatoire car une réponse ne peut être lue qu'une fois.
        const copie = reponse.clone();
        caches.open(NOM_CACHE).then(function (cache) {
          cache.put(evenement.request, copie);
        });
        return reponse;
      })
      .catch(function () {
        // Pas de réseau : on sert la réserve.
        return caches.match(evenement.request).then(function (copieLocale) {
          return copieLocale || caches.match('./index.html');
        });
      })
  );
});
