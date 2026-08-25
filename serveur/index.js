/* ═══════════════════════════════════════════════════════════
   VOCAPP — LE SERVEUR
   ───────────────────────────────────────────────────────────
   Un « Worker » Cloudflare, c'est un programme qui dort et qui
   se réveille à chaque fois qu'on lui parle. Il ne tourne pas
   en continu comme un ordinateur allumé : Cloudflare le démarre
   en quelques millisecondes quand une requête arrive, puis le
   rendort. C'est pour ça que c'est gratuit et que ça ne s'endort
   jamais vraiment.

   Ce fichier ne fait qu'une chose : AIGUILLER. Il regarde
   l'adresse demandée et appelle le bon spécialiste. Aucune
   logique métier ici — exactement le rôle de js/app.js côté
   application.
   ═══════════════════════════════════════════════════════════ */

import {
  entetesCors, reponseJson, reponseErreur, reponseVide, lireCorpsJson
} from './reponses.js';

import {
  creerCompte, verifierIdentifiants,
  ouvrirSession, fermerSession, jetonDeLaRequete, utilisateurDeLaRequete,
  indexerUtilisateur, utilisateurPublic
} from './comptes.js';

const VERSION_SERVEUR = 'v0.2.1';

/** La page qu'on voit en ouvrant l'adresse du serveur dans un navigateur. */
function pageAccueil(requete) {
  const texte =
    'Vocapp — serveur ' + VERSION_SERVEUR + '\n\n' +
    'Ceci n\'est pas l\'application, mais le programme qui tourne\n' +
    'derriere : il garde les mots en ligne et enverra les rappels.\n\n' +
    'L\'application est ici :\n' +
    '  https://arnaud-legrand.github.io/Vocapp/\n\n' +
    'Le code est ici :\n' +
    '  https://github.com/Arnaud-Legrand/Vocapp\n\n' +
    'Adresses disponibles :\n' +
    '  GET  /api/sante        etat du serveur\n' +
    '  POST /api/inscription  creer un compte\n' +
    '  POST /api/connexion    ouvrir une session\n' +
    '  POST /api/deconnexion  fermer la session en cours\n' +
    '  GET  /api/moi          qui suis-je\n';

  return new Response(texte, {
    headers: Object.assign(
      { 'Content-Type': 'text/plain; charset=utf-8' },
      entetesCors(requete)
    )
  });
}

/* ─────────── Les routes, une fonction chacune ─────────── */

async function routeInscription(requete, env) {
  const corps = await lireCorpsJson(requete);
  if (!corps) return reponseErreur(requete, 'Requête illisible.', 400);

  const resultat = await creerCompte(env, corps.email, corps.motDePasse);
  if (resultat.erreur) return reponseErreur(requete, resultat.erreur, resultat.statut);

  await indexerUtilisateur(env, resultat.utilisateur);
  const jeton = await ouvrirSession(env, resultat.utilisateur.id);

  return reponseJson(requete, {
    jeton: jeton,
    utilisateur: utilisateurPublic(resultat.utilisateur)
  }, 201);
}

async function routeConnexion(requete, env) {
  const corps = await lireCorpsJson(requete);
  if (!corps) return reponseErreur(requete, 'Requête illisible.', 400);

  const resultat = await verifierIdentifiants(env, corps.email, corps.motDePasse);
  if (resultat.erreur) return reponseErreur(requete, resultat.erreur, resultat.statut);

  // On réindexe au passage : utile pour les comptes créés avant
  // l'existence de cet index.
  await indexerUtilisateur(env, resultat.utilisateur);
  const jeton = await ouvrirSession(env, resultat.utilisateur.id);

  return reponseJson(requete, {
    jeton: jeton,
    utilisateur: utilisateurPublic(resultat.utilisateur)
  });
}

async function routeDeconnexion(requete, env) {
  await fermerSession(env, jetonDeLaRequete(requete));
  return reponseVide(requete, 204);
}

async function routeMoi(requete, env) {
  const utilisateur = await utilisateurDeLaRequete(env, requete);
  if (!utilisateur) return reponseErreur(requete, 'Session absente ou expirée.', 401);
  return reponseJson(requete, { utilisateur: utilisateurPublic(utilisateur) });
}

async function routeSante(requete, env) {
  return reponseJson(requete, {
    etat: 'ok',
    service: 'vocapp',
    version: VERSION_SERVEUR,
    heure: new Date().toISOString(),
    baseDeDonneesBranchee: typeof env.CARNETS !== 'undefined'
  });
}

/* ─────────── Le tableau d'aiguillage ─────────── */

const ROUTES = {
  'GET /api/sante': routeSante,
  'POST /api/inscription': routeInscription,
  'POST /api/connexion': routeConnexion,
  'POST /api/deconnexion': routeDeconnexion,
  'GET /api/moi': routeMoi
};

export default {
  /**
   * Appelée à CHAQUE requête reçue.
   *   requete = ce qu'on nous demande
   *   env     = les ressources branchées au Worker (base, secrets)
   */
  async fetch(requete, env) {
    const url = new URL(requete.url);

    // Avant une vraie requête vers un autre domaine, le navigateur
    // envoie d'abord une question : « ai-je le droit ? ». C'est la
    // requête OPTIONS, qu'il faut accepter explicitement.
    if (requete.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: entetesCors(requete) });
    }

    if (url.pathname === '/' || url.pathname === '') {
      return pageAccueil(requete);
    }

    // Toutes les routes ont besoin de la base : si elle n'est pas
    // branchée, mieux vaut le dire clairement que planter plus loin.
    if (!env.CARNETS && url.pathname !== '/api/sante') {
      return reponseErreur(requete, 'Base de données non branchée sur le serveur.', 503);
    }

    const route = ROUTES[requete.method + ' ' + url.pathname];
    if (!route) {
      return reponseErreur(requete, 'Adresse inconnue : ' + url.pathname, 404);
    }

    try {
      return await route(requete, env);
    } catch (erreur) {
      // On journalise le détail pour nous, et on renvoie un message
      // neutre : le contenu d'une erreur en dit souvent trop long.
      console.error('Erreur sur ' + url.pathname, erreur);
      return reponseErreur(requete, 'Erreur interne du serveur.', 500);
    }
  }
};
