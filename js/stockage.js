/* ═══════════════════════════════════════════════════════════
   STOCKAGE — ranger et retrouver les mots
   ───────────────────────────────────────────────────────────
   On utilise "localStorage", un petit espace de rangement que
   chaque navigateur réserve à chaque site. Il a deux limites
   importantes à connaître :
     1. il ne sait stocker que du TEXTE (d'où JSON.stringify) ;
     2. il est propre à cet appareil ET à ce navigateur.
   C'est exactement pour lever la limite n°2 qu'on ajoutera un
   serveur au palier 2.
   ═══════════════════════════════════════════════════════════ */

const CLE_STOCKAGE = 'vocab.mots.v1';

/** Lit tous les mots enregistrés. Renvoie toujours un tableau. */
function chargerMots() {
  const brut = localStorage.getItem(CLE_STOCKAGE);
  if (!brut) return [];
  try {
    const mots = JSON.parse(brut);
    return Array.isArray(mots) ? mots : [];
  } catch (erreur) {
    // Si les données sont abîmées, mieux vaut repartir vide que planter.
    console.error('Données illisibles :', erreur);
    return [];
  }
}

/** Enregistre le tableau complet des mots. */
function sauvegarderMots(mots) {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(mots));
}

/**
 * Met une majuscule à la première lettre : "bom dia" devient "Bom dia".
 * S'il y a plusieurs traductions séparées par "/" ou ",", chacune est
 * traitée : "bom dia / olá" devient "Bom dia / Olá".
 *
 * Cela ne change RIEN à la notation : la comparaison des réponses passe
 * par normaliser(), qui remet tout en minuscules avant de comparer.
 * C'est purement une question de présentation.
 */
function majusculeInitiale(texte) {
  return String(texte || '')
    .trim()
    .replace(/\s+/g, ' ')
    // On découpe en gardant les séparateurs, pour les remettre ensuite.
    .split(/([\/,])/)
    .map(function (morceau) {
      const propre = morceau.trim();
      if (propre === '' || propre === '/' || propre === ',') return morceau;
      return propre.charAt(0).toUpperCase() + propre.slice(1);
    })
    .join('')
    // Typographie : une espace de chaque côté de la barre oblique,
    // mais seulement APRÈS la virgule.
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

/** Fabrique un nouveau mot, prêt à être révisé tout de suite. */
function creerMot(fr, pt, note) {
  return {
    // Un identifiant unique = l'heure actuelle + un peu de hasard.
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    fr: majusculeInitiale(fr),
    pt: majusculeInitiale(pt),
    note: majusculeInitiale(note),
    creeLe: Date.now(),
    niveau: 0,                     // 0 = tout neuf ; monte à chaque réussite
    prochaineRevision: Date.now(), // à réviser immédiatement
    historique: []                 // les dernières notes obtenues
  };
}

function ajouterMot(fr, pt, note) {
  const mots = chargerMots();
  const nouveau = creerMot(fr, pt, note);
  mots.push(nouveau);
  sauvegarderMots(mots);
  return nouveau;
}

function supprimerMot(id) {
  // filter() garde tous les mots SAUF celui dont l'id correspond.
  sauvegarderMots(chargerMots().filter(mot => mot.id !== id));
}

/** Remplace un mot existant par sa version mise à jour. */
function enregistrerMot(motModifie) {
  const mots = chargerMots();
  const position = mots.findIndex(mot => mot.id === motModifie.id);
  if (position === -1) return;
  mots[position] = motModifie;
  sauvegarderMots(mots);
}

/**
 * Ajoute les mots d'une sauvegarde SANS toucher à ceux déjà présents.
 * Un mot déjà connu (même identifiant) est ignoré : importer deux fois
 * la même sauvegarde ne crée donc jamais de doublons, et n'efface
 * jamais une progression plus récente.
 */
function importerListe(arrivants) {
  const mots = chargerMots();
  const idsConnus = mots.map(function (mot) { return mot.id; });
  let ajoutes = 0;
  let ignores = 0;

  arrivants.forEach(function (arrivant) {
    // On se méfie du contenu reçu : il a pu être modifié à la main.
    if (!arrivant || !arrivant.fr || !arrivant.pt) return;
    if (arrivant.id && idsConnus.indexOf(arrivant.id) !== -1) {
      ignores++;
      return;
    }

    const mot = creerMot(String(arrivant.fr), String(arrivant.pt), arrivant.note);
    // On récupère la progression si la sauvegarde en contient une.
    if (arrivant.id) mot.id = arrivant.id;
    if (typeof arrivant.creeLe === 'number') mot.creeLe = arrivant.creeLe;
    if (typeof arrivant.niveau === 'number') mot.niveau = arrivant.niveau;
    if (typeof arrivant.prochaineRevision === 'number') mot.prochaineRevision = arrivant.prochaineRevision;
    if (Array.isArray(arrivant.historique)) mot.historique = arrivant.historique;

    mots.push(mot);
    idsConnus.push(mot.id);
    ajoutes++;
  });

  sauvegarderMots(mots);
  return { ajoutes: ajoutes, ignores: ignores };
}

/**
 * Une « migration » : une retouche appliquée UNE SEULE FOIS aux données
 * déjà enregistrées, pour les mettre au format d'une nouvelle version.
 * Ici, on ajoute la majuscule aux mots saisis avant que la règle existe.
 * Le repère posé dans localStorage évite de refaire le travail à chaque
 * ouverture — et surtout d'écraser une correction faite à la main.
 */
function appliquerMajusculesAuxAnciensMots() {
  const CLE_MIGRATION = 'vocapp.migration.majuscules';
  if (localStorage.getItem(CLE_MIGRATION) === 'fait') return 0;

  const mots = chargerMots();
  let modifies = 0;

  mots.forEach(function (mot) {
    const fr = majusculeInitiale(mot.fr);
    const pt = majusculeInitiale(mot.pt);
    if (fr !== mot.fr || pt !== mot.pt) modifies++;
    mot.fr = fr;
    mot.pt = pt;
    mot.note = majusculeInitiale(mot.note);
  });

  sauvegarderMots(mots);
  localStorage.setItem(CLE_MIGRATION, 'fait');
  return modifies;
}

/** Les mots dont l'heure de révision est arrivée, les plus urgents d'abord. */
function motsAReviser() {
  const maintenant = Date.now();
  return chargerMots()
    .filter(mot => mot.prochaineRevision <= maintenant)
    .sort((a, b) => a.prochaineRevision - b.prochaineRevision);
}
