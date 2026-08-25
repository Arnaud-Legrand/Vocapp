/* ═══════════════════════════════════════════════════════════
   RÉVISION — le cerveau de l'application
   ───────────────────────────────────────────────────────────
   Deux responsabilités :
     1. comparer ma réponse au mot attendu -> vert / orange / rouge
     2. décider dans combien de temps le mot doit revenir
   ═══════════════════════════════════════════════════════════ */

const MINUTE = 60 * 1000;          // tout est compté en millisecondes
const HEURE  = 60 * MINUTE;
const JOUR   = 24 * HEURE;

/* L'échelle de la répétition espacée.
   Chaque case = le délai avant de revoir un mot de ce niveau.
   Niveau 0 -> dans 10 min ... niveau 7 -> dans 2 semaines.

   Les écarts grandissent, parce que la mémoire retient d'autant
   mieux qu'on est réinterrogé juste avant d'oublier. Mais le
   plafond est volontairement bas : deux semaines. Au-delà, un mot
   disparaîtrait trop longtemps de la circulation, et l'intérêt
   ici est de garder le vocabulaire vivant, pas de l'archiver. */
const INTERVALLES = [
  10 * MINUTE,   // niveau 0
   1 * HEURE,    // niveau 1
   4 * HEURE,    // niveau 2
   1 * JOUR,     // niveau 3
   2 * JOUR,     // niveau 4
   4 * JOUR,     // niveau 5
   7 * JOUR,     // niveau 6
  14 * JOUR      // niveau 7
];

const NIVEAU_MAXIMUM = INTERVALLES.length - 1;

/* Les trois familles affichées sur l'accueil. Un mot appartient
   toujours à une seule d'entre elles.
     niveau 0     -> à revoir  : jamais réussi, ou raté au dernier passage
     niveau 1 à 4 -> en cours  : au moins une réussite, pas encore ancré
     niveau 5 à 7 -> acquis    : revient tous les 4 jours ou plus */
const NIVEAU_EN_COURS = 1;
const NIVEAU_ACQUIS = 5;

/** Ramène un niveau dans les bornes valides, quoi qu'il arrive. */
function niveauValide(niveau) {
  if (typeof niveau !== 'number' || isNaN(niveau)) return 0;
  return Math.max(0, Math.min(Math.round(niveau), NIVEAU_MAXIMUM));
}

/* ─────────── 1. Comparer les réponses ─────────── */

/** Met le texte en minuscules et enlève ponctuation et espaces en trop. */
function normaliser(texte) {
  return texte
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?"]/g, '')
    .replace(/['’]/g, '');
}

/** Enlève les accents : "avó" devient "avo", "coração" devient "coracao". */
function sansAccents(texte) {
  // normalize('NFD') sépare chaque lettre de son accent : "ó" devient "o" + "´".
  // Ensuite on ne garde que les lettres simples, chiffres et espaces :
  // les accents, désormais isolés, disparaissent.
  return texte.normalize('NFD').replace(/[^a-z0-9 -]/gi, '');
}

/**
 * Distance de Levenshtein : le nombre minimum de corrections
 * (ajouter, supprimer ou remplacer une lettre) pour passer d'un
 * mot à l'autre. "obrigado" vs "obrigada" -> 1.
 * C'est ce chiffre qui permet de distinguer une faute de frappe
 * d'une réponse complètement fausse.
 */
function distance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let ligneAvant = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const ligneActuelle = [i];
    for (let j = 1; j <= b.length; j++) {
      const coutRemplacement = a[i - 1] === b[j - 1] ? 0 : 1;
      ligneActuelle[j] = Math.min(
        ligneAvant[j] + 1,                       // suppression
        ligneActuelle[j - 1] + 1,                // insertion
        ligneAvant[j - 1] + coutRemplacement     // remplacement
      );
    }
    ligneAvant = ligneActuelle;
  }
  return ligneAvant[b.length];
}

/** Combien de fautes on tolère avant de passer en rouge. */
function toleranceOrange(longueur) {
  if (longueur <= 4) return 1;
  if (longueur <= 8) return 2;
  return 3;
}

/** Compare ma réponse à UNE traduction attendue. */
function evaluerUne(reponse, attendu) {
  const r = normaliser(reponse);
  const a = normaliser(attendu);

  if (r.length === 0) return 'rouge';
  if (r === a) return 'vert';                             // parfait
  if (sansAccents(r) === sansAccents(a)) return 'orange'; // juste un accent

  return distance(r, a) <= toleranceOrange(a.length) ? 'orange' : 'rouge';
}

/**
 * Compare ma réponse au mot attendu, qui peut contenir plusieurs
 * traductions séparées par "/" ou ",". On garde le meilleur résultat.
 */
function comparerReponse(reponse, attendu) {
  const propositions = attendu.split(/[\/,]/).map(t => t.trim()).filter(Boolean);
  let meilleur = 'rouge';
  for (const proposition of propositions) {
    const resultat = evaluerUne(reponse, proposition);
    if (resultat === 'vert') return 'vert';
    if (resultat === 'orange') meilleur = 'orange';
  }
  return meilleur;
}

/* ─────────── 2. Décider quand revoir le mot ─────────── */

/** Le nouveau niveau du mot selon la note obtenue. */
function niveauApres(niveau, score) {
  const depart = niveauValide(niveau);
  if (score === 'vert')   return Math.min(depart + 1, NIVEAU_MAXIMUM); // on monte
  if (score === 'orange') return Math.max(depart - 1, 0);              // on redescend d'un cran
  return 0;                                                            // rouge : on repart de zéro
}

/** Applique la note au mot : nouveau niveau + nouvelle date de révision. */
function appliquerResultat(mot, score) {
  mot.niveau = niveauApres(mot.niveau, score);
  mot.prochaineRevision = Date.now() + INTERVALLES[mot.niveau];
  mot.historique.push({ date: Date.now(), score: score });
  if (mot.historique.length > 20) mot.historique.shift(); // on ne garde que les 20 dernières
  return mot;
}

/** Le délai qu'obtiendrait le mot avec cette note (sans rien modifier). */
function delaiApres(mot, score) {
  return INTERVALLES[niveauApres(mot.niveau, score)];
}

/* ─────────── 3. Affichage des durées ─────────── */

function formaterDelai(millisecondes) {
  const minutes = Math.round(millisecondes / MINUTE);
  if (minutes < 1)  return 'moins d’une minute';
  if (minutes < 60) return minutes + ' minute' + (minutes > 1 ? 's' : '');

  const heures = Math.round(minutes / 60);
  if (heures < 24)  return heures + ' heure' + (heures > 1 ? 's' : '');

  const jours = Math.round(heures / 24);
  if (jours < 31)   return jours + ' jour' + (jours > 1 ? 's' : '');

  const mois = Math.round(jours / 30);
  return mois + ' mois';
}
