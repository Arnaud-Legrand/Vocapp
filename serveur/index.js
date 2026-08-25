/* ═══════════════════════════════════════════════════════════
   VOCAPP — LE SERVEUR
   ───────────────────────────────────────────────────────────
   Première pierre du palier 2.

   Un « Worker » Cloudflare, c'est un programme qui dort et qui
   se réveille à chaque fois qu'on lui parle. Il ne tourne pas
   en continu comme un vrai ordinateur allumé : Cloudflare le
   démarre en quelques millisecondes quand une requête arrive,
   puis le rendort. C'est pour ça que c'est gratuit et que ça ne
   s'endort jamais vraiment.

   Tout part de la fonction `fetch` ci-dessous : elle reçoit une
   requête, elle renvoie une réponse. C'est tout ce qu'est un
   serveur web, au fond.

   Pour l'instant il ne sait faire qu'une chose : répondre « je
   suis vivant ». C'est volontaire — on vérifie d'abord que la
   chaîne complète fonctionne (ton PC → GitHub → Cloudflare →
   ton téléphone) avant d'y mettre quoi que ce soit de sérieux.
   ═══════════════════════════════════════════════════════════ */

const VERSION_SERVEUR = 'v0.1.0';

/* Les adresses autorisées à parler à ce serveur.
   ─────────────────────────────────────────────
   Par sécurité, un navigateur interdit à un site d'appeler un
   autre domaine que le sien, sauf si ce dernier donne son accord
   explicite. C'est la règle dite « CORS ». Sans cette liste,
   l'appli sur github.io ne pourrait pas parler à ce serveur.

   On énumère les adresses au lieu d'autoriser tout le monde :
   c'est une bonne habitude à prendre dès le premier jour. */
const ORIGINES_AUTORISEES = [
  'https://arnaud-legrand.github.io',
  'http://localhost:8000'
];

/** Les en-têtes qui donnent l'autorisation, adaptés à l'appelant. */
function entetesCors(requete) {
  const origine = requete.headers.get('Origin');
  const autorisee = ORIGINES_AUTORISEES.indexOf(origine) !== -1;

  return {
    'Access-Control-Allow-Origin': autorisee ? origine : ORIGINES_AUTORISEES[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

/** Fabrique une réponse au format JSON, avec les autorisations. */
function reponseJson(requete, donnees, statut) {
  return new Response(JSON.stringify(donnees, null, 2), {
    status: statut || 200,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8' },
      entetesCors(requete)
    )
  });
}

/** La page qu'on voit en ouvrant l'adresse du serveur dans un navigateur. */
function pageAccueil(requete) {
  const texte =
    'Vocapp — serveur ' + VERSION_SERVEUR + '\n\n' +
    'Ceci n\'est pas l\'application, mais le programme qui tourne\n' +
    'derriere : il enverra les rappels et gardera les mots en ligne.\n\n' +
    'L\'application est ici :\n' +
    '  https://arnaud-legrand.github.io/Vocapp/\n\n' +
    'Le code est ici :\n' +
    '  https://github.com/Arnaud-Legrand/Vocapp\n\n' +
    'Adresses disponibles :\n' +
    '  GET /api/sante   etat du serveur\n';

  return new Response(texte, {
    headers: Object.assign(
      { 'Content-Type': 'text/plain; charset=utf-8' },
      entetesCors(requete)
    )
  });
}

export default {
  /**
   * Appelée à CHAQUE requête reçue.
   *   requete = ce qu'on nous demande
   *   env     = les ressources branchées au Worker (bases, secrets)
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

    // Le « pouls » du serveur : sert à vérifier qu'il répond, et
    // à quelle version. C'est la première chose qu'on branche sur
    // un serveur, et la dernière qu'on retire.
    if (url.pathname === '/api/sante') {
      return reponseJson(requete, {
        etat: 'ok',
        service: 'vocapp',
        version: VERSION_SERVEUR,
        heure: new Date().toISOString(),
        // `env.CARNETS` sera la base de données. Tant qu'elle n'est
        // pas branchée, ce champ vaut false — pratique pour vérifier
        // l'installation sans avoir à lire les journaux.
        baseDeDonneesBranchee: typeof env.CARNETS !== 'undefined'
      });
    }

    return reponseJson(requete, {
      erreur: 'Adresse inconnue',
      chemin: url.pathname
    }, 404);
  }
};
