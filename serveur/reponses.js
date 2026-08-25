/* ═══════════════════════════════════════════════════════════
   RÉPONSES — fabriquer ce qu'on renvoie au navigateur
   ───────────────────────────────────────────────────────────
   Tout ce que le serveur renvoie passe par ici : même format,
   mêmes autorisations, partout. Regrouper ça en un seul endroit
   évite d'oublier un en-tête sur une route et de passer une
   heure à comprendre pourquoi « ça marche ailleurs ».
   ═══════════════════════════════════════════════════════════ */

/* Les adresses autorisées à parler à ce serveur.
   ─────────────────────────────────────────────
   Par sécurité, un navigateur interdit à un site d'appeler un
   autre domaine que le sien, sauf si ce dernier donne son accord
   explicite. C'est la règle dite « CORS ». Sans cette liste,
   l'appli sur github.io ne pourrait pas parler à ce serveur.

   On énumère les adresses au lieu d'autoriser tout le monde :
   c'est une bonne habitude à prendre dès le premier jour. */
export const ORIGINES_AUTORISEES = [
  'https://arnaud-legrand.github.io',
  'http://localhost:8000'
];

/** Les en-têtes qui donnent l'autorisation, adaptés à l'appelant. */
export function entetesCors(requete) {
  const origine = requete.headers.get('Origin');
  const autorisee = ORIGINES_AUTORISEES.indexOf(origine) !== -1;

  return {
    'Access-Control-Allow-Origin': autorisee ? origine : ORIGINES_AUTORISEES[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    // Le contenu change selon l'appelant : sans ce Vary, un cache
    // pourrait resservir à un site la réponse destinée à un autre.
    'Vary': 'Origin'
  };
}

/** Fabrique une réponse au format JSON, avec les autorisations. */
export function reponseJson(requete, donnees, statut) {
  return new Response(JSON.stringify(donnees, null, 2), {
    status: statut || 200,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8' },
      entetesCors(requete)
    )
  });
}

/** Une réponse d'erreur, toujours de la même forme. */
export function reponseErreur(requete, message, statut) {
  return reponseJson(requete, { erreur: message }, statut || 400);
}

/** Une réponse sans contenu (pour une suppression réussie, par exemple). */
export function reponseVide(requete, statut) {
  return new Response(null, {
    status: statut || 204,
    headers: entetesCors(requete)
  });
}

/**
 * Lit le corps JSON d'une requête sans jamais faire planter le serveur.
 * Ce qui arrive de l'extérieur n'est JAMAIS digne de confiance : ce
 * pourrait être du texte quelconque, ou rien du tout.
 */
export async function lireCorpsJson(requete) {
  try {
    const donnees = await requete.json();
    if (donnees === null || typeof donnees !== 'object') return null;
    return donnees;
  } catch (erreur) {
    return null;
  }
}
