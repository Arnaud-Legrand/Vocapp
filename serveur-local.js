/* ═══════════════════════════════════════════════════════════
   SERVEUR LOCAL — pour tester l'appli sur mon ordinateur
   ───────────────────────────────────────────────────────────
   Pourquoi ce fichier ?
   Si on ouvre index.html par un double-clic, l'adresse commence
   par "file://". Or les navigateurs interdisent le mode
   hors-ligne (service worker) et l'installation d'une appli
   depuis une adresse "file://" — pour des raisons de sécurité.
   Ce petit serveur sert donc les mêmes fichiers en "http://",
   ce qui reproduit les conditions réelles du site en ligne.

   Pour le lancer :  node serveur-local.js
   Puis ouvrir :     http://localhost:8000
   Pour l'arrêter :  Ctrl + C

   Ce fichier ne fait PAS partie de l'application : il ne sera
   jamais utilisé une fois le site hébergé sur GitHub Pages.
   ═══════════════════════════════════════════════════════════ */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

// À quel "type" correspond chaque extension de fichier. Le navigateur
// a besoin de cette information pour savoir quoi faire du contenu.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

http.createServer(function (requete, reponse) {
  // On enlève les paramètres éventuels (?x=1) de l'adresse demandée.
  let chemin = decodeURIComponent(requete.url.split('?')[0]);
  if (chemin === '/') chemin = '/index.html';

  const fichier = path.join(__dirname, chemin);

  // Sécurité : on refuse toute demande qui sortirait du dossier du projet.
  if (!fichier.startsWith(__dirname)) {
    reponse.writeHead(403);
    return reponse.end('Interdit');
  }

  fs.readFile(fichier, function (erreur, contenu) {
    if (erreur) {
      reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return reponse.end('Fichier introuvable : ' + chemin);
    }
    const type = TYPES[path.extname(fichier)] || 'application/octet-stream';
    // no-store : pendant le développement, on veut toujours la dernière version.
    reponse.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    reponse.end(contenu);
  });
}).listen(PORT, function () {
  console.log('Appli disponible sur http://localhost:' + PORT);
});
