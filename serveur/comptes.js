/* ═══════════════════════════════════════════════════════════
   COMPTES — inscription, connexion, sessions
   ───────────────────────────────────────────────────────────
   Le fichier le plus délicat du projet. Trois règles y sont
   appliquées, et elles ne sont pas négociables :

   1. ON N'ENREGISTRE JAMAIS UN MOT DE PASSE.
      On enregistre une empreinte : un calcul dont on ne peut
      pas revenir en arrière. Si quelqu'un volait la base, il
      n'y trouverait aucun mot de passe utilisable. C'est aussi
      pour ça que ni Cloudflare, ni moi, ne pourrons jamais te
      dire quel est ton mot de passe — seulement le remplacer.

   2. LE CALCUL EST VOLONTAIREMENT LENT.
      Une empreinte rapide se casse par force brute : on essaie
      des millions de mots de passe par seconde. En répétant le
      calcul des dizaines de milliers de fois, on rend chaque
      essai coûteux. Toi tu attends quelques centièmes de
      seconde ; un attaquant, lui, attend des siècles.

   3. LE SEL.
      Chaque compte reçoit une valeur aléatoire, mêlée au mot de
      passe avant le calcul. Sans elle, deux personnes ayant le
      même mot de passe auraient la même empreinte, et une seule
      table pré-calculée les casserait toutes d'un coup.
   ═══════════════════════════════════════════════════════════ */

/* Nombre de répétitions du calcul. Plus c'est haut, plus c'est sûr.

   Cette valeur n'a pas été choisie au jugé : elle a été MESURÉE sur le
   serveur réel, le 25 août 2026, avec une route de diagnostic depuis
   retirée. Résultat sur l'offre gratuite de Cloudflare (10 ms de calcul
   par requête) :

       10 000 → passe        150 000 → refusé
       50 000 → passe        200 000 → refusé
      100 000 → passe        500 000 → refusé

   On retient donc 100 000, le plus haut palier qui tienne. Les
   recommandations actuelles pour ce type de calcul parlent plutôt de
   600 000 : on est en dessous, faute de temps de calcul disponible.
   La vraie protection reste donc un mot de passe long et unique.

   Si une connexion échouait un jour avec une erreur 500, ce serait le
   premier réglage à baisser. */
export const ITERATIONS = 100000;

/** Une session dure 30 jours avant de devoir se reconnecter. */
const DUREE_SESSION_SECONDES = 60 * 60 * 24 * 30;

/** Au-delà de 8 essais ratés en 15 minutes, on bloque temporairement. */
const ESSAIS_MAXIMUM = 8;
const DUREE_BLOCAGE_SECONDES = 900;

/* ─────────── Petits outils ─────────── */

/** Des octets vraiment imprévisibles (pas Math.random, inadapté ici). */
function octetsAleatoires(nombre) {
  return crypto.getRandomValues(new Uint8Array(nombre));
}

/** Transforme des octets en texte transportable dans une adresse web. */
function versTexte(octets) {
  let binaire = '';
  const tableau = new Uint8Array(octets);
  for (let i = 0; i < tableau.length; i++) binaire += String.fromCharCode(tableau[i]);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function versOctets(texte) {
  const complete = texte.replace(/-/g, '+').replace(/_/g, '/');
  const binaire = atob(complete);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}

/**
 * Compare deux textes en prenant TOUJOURS le même temps.
 * Une comparaison normale s'arrête à la première différence : en
 * mesurant très finement ce temps, on peut deviner un secret
 * caractère par caractère. Ici on parcourt tout, systématiquement.
 */
function comparaisonSure(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/** L'empreinte d'un mot de passe, avec son sel. */
export async function calculerEmpreinte(motDePasse, sel, iterations) {
  const cle = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: versOctets(sel), iterations: iterations, hash: 'SHA-256' },
    cle, 256
  );
  return versTexte(bits);
}

/** L'empreinte courte d'un jeton de session. */
async function empreinteJeton(jeton) {
  const bits = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jeton));
  return versTexte(bits);
}

/* ─────────── Vérifications de saisie ─────────── */

export function normaliserEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function emailValide(email) {
  // Volontairement simple : la seule preuve qu'une adresse existe,
  // c'est d'y envoyer un message. On écarte juste l'absurde.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 200;
}

export function problemeMotDePasse(motDePasse) {
  const texte = String(motDePasse || '');
  if (texte.length < 8) return 'Le mot de passe doit faire au moins 8 caractères.';
  if (texte.length > 200) return 'Le mot de passe est trop long.';
  return null;
}

/* ─────────── Limitation des essais ─────────── */

async function essaisRates(env, email) {
  const valeur = await env.CARNETS.get('essais:' + email);
  return valeur ? parseInt(valeur, 10) : 0;
}

async function noterEssaiRate(env, email) {
  const compte = (await essaisRates(env, email)) + 1;
  await env.CARNETS.put('essais:' + email, String(compte),
    { expirationTtl: DUREE_BLOCAGE_SECONDES });
}

async function oublierEssais(env, email) {
  await env.CARNETS.delete('essais:' + email);
}

/* ─────────── Comptes ─────────── */

export async function lireUtilisateur(env, email) {
  const brut = await env.CARNETS.get('utilisateur:' + email);
  return brut ? JSON.parse(brut) : null;
}

/**
 * Crée un compte. Renvoie { utilisateur } ou { erreur, statut }.
 * On ne renvoie jamais l'empreinte ni le sel : ils ne quittent
 * jamais le serveur.
 */
export async function creerCompte(env, emailBrut, motDePasse) {
  const email = normaliserEmail(emailBrut);

  if (!emailValide(email)) {
    return { erreur: 'Cette adresse e-mail ne semble pas valide.', statut: 400 };
  }
  const souci = problemeMotDePasse(motDePasse);
  if (souci) return { erreur: souci, statut: 400 };

  if (await lireUtilisateur(env, email)) {
    return { erreur: 'Un compte existe déjà avec cette adresse.', statut: 409 };
  }

  const sel = versTexte(octetsAleatoires(16));
  const utilisateur = {
    id: versTexte(octetsAleatoires(12)),
    email: email,
    sel: sel,
    iterations: ITERATIONS,
    empreinte: await calculerEmpreinte(motDePasse, sel, ITERATIONS),
    creeLe: Date.now()
  };

  await env.CARNETS.put('utilisateur:' + email, JSON.stringify(utilisateur));
  return { utilisateur: utilisateur };
}

/**
 * Vérifie un couple adresse / mot de passe.
 * Le message d'erreur est le MÊME que l'adresse soit inconnue ou le
 * mot de passe faux : sinon, on offrirait à un curieux le moyen de
 * savoir qui possède un compte ici.
 */
export async function verifierIdentifiants(env, emailBrut, motDePasse) {
  const email = normaliserEmail(emailBrut);
  const refus = { erreur: 'Adresse e-mail ou mot de passe incorrect.', statut: 401 };

  if (await essaisRates(env, email) >= ESSAIS_MAXIMUM) {
    return { erreur: 'Trop d’essais. Réessaie dans un quart d’heure.', statut: 429 };
  }

  const utilisateur = await lireUtilisateur(env, email);
  if (!utilisateur) {
    await noterEssaiRate(env, email);
    return refus;
  }

  const empreinte = await calculerEmpreinte(
    String(motDePasse || ''), utilisateur.sel, utilisateur.iterations || ITERATIONS
  );

  if (!comparaisonSure(empreinte, utilisateur.empreinte)) {
    await noterEssaiRate(env, email);
    return refus;
  }

  await oublierEssais(env, email);
  return { utilisateur: utilisateur };
}

/* ─────────── Sessions ─────────── */

/**
 * Ouvre une session et renvoie le jeton à conserver par l'appli.
 * On range dans la base l'EMPREINTE du jeton, pas le jeton lui-même :
 * même raisonnement que pour les mots de passe. Si la base fuitait,
 * les jetons volés seraient inutilisables.
 */
export async function ouvrirSession(env, utilisateurId) {
  const jeton = versTexte(octetsAleatoires(32));
  const empreinte = await empreinteJeton(jeton);

  await env.CARNETS.put(
    'session:' + empreinte,
    JSON.stringify({ utilisateurId: utilisateurId, ouverteLe: Date.now() }),
    { expirationTtl: DUREE_SESSION_SECONDES }
  );

  return jeton;
}

export async function fermerSession(env, jeton) {
  if (!jeton) return;
  await env.CARNETS.delete('session:' + (await empreinteJeton(jeton)));
}

/** Extrait le jeton de l'en-tête « Authorization: Bearer … ». */
export function jetonDeLaRequete(requete) {
  const entete = requete.headers.get('Authorization') || '';
  return entete.startsWith('Bearer ') ? entete.slice(7).trim() : null;
}

/**
 * Retrouve l'utilisateur derrière une requête, ou null.
 * C'est le portier : toute route privée commence par l'appeler.
 */
export async function utilisateurDeLaRequete(env, requete) {
  const jeton = jetonDeLaRequete(requete);
  if (!jeton) return null;

  const brut = await env.CARNETS.get('session:' + (await empreinteJeton(jeton)));
  if (!brut) return null;

  const session = JSON.parse(brut);

  // La session ne retient qu'un identifiant ; l'index dit à quelle
  // adresse il correspond, et c'est l'adresse qui range le compte.
  const email = await env.CARNETS.get('id:' + session.utilisateurId);
  if (!email) return null;

  return lireUtilisateur(env, email);
}

/** Range la correspondance identifiant → adresse, pour le portier. */
export async function indexerUtilisateur(env, utilisateur) {
  await env.CARNETS.put('id:' + utilisateur.id, utilisateur.email);
}

/** La version d'un utilisateur qu'on accepte de renvoyer à l'appli. */
export function utilisateurPublic(utilisateur) {
  return { id: utilisateur.id, email: utilisateur.email, creeLe: utilisateur.creeLe };
}
