/* ═══════════════════════════════════════════════════════════
   APP — le chef d'orchestre
   ───────────────────────────────────────────────────────────
   Ce fichier ne contient AUCUNE règle métier : il ne sait ni
   comment on note une réponse, ni où sont rangés les mots. Il
   se contente d'écouter ce que fait l'utilisateur et d'appeler
   les fonctions des deux autres fichiers.
   C'est un principe important : "séparer les responsabilités".
   Si demain on change la façon de stocker les mots, on ne
   touche qu'à stockage.js.
   ═══════════════════════════════════════════════════════════ */

/** Raccourci : element('mot-question') au lieu de document.getElementById(...) */
function element(identifiant) {
  return document.getElementById(identifiant);
}

/* ─────────── Mémoire de la session de révision en cours ─────────── */
let fileRevision = [];   // les mots à poser, dans l'ordre
let indexRevision = 0;   // où on en est dans cette file
let motActuel = null;    // le mot affiché en ce moment
let scoreActuel = null;  // la note retenue pour ce mot

/* ═══════════════ NAVIGATION ENTRE LES ÉCRANS ═══════════════ */

function afficherEcran(identifiantEcran) {
  // On cache tous les écrans sauf celui demandé.
  document.querySelectorAll('.ecran').forEach(function (ecran) {
    ecran.hidden = (ecran.id !== identifiantEcran);
  });

  // On met en valeur le bon onglet en bas.
  document.querySelectorAll('.onglet').forEach(function (onglet) {
    onglet.classList.toggle('actif', onglet.dataset.cible === identifiantEcran);
  });

  // Pendant une révision, on masque la barre du bas pour rester concentré.
  element('navigation').hidden = (identifiantEcran === 'ecran-revision');

  window.scrollTo(0, 0);

  // Chaque écran se met à jour au moment où on l'affiche.
  if (identifiantEcran === 'ecran-accueil') rafraichirAccueil();
  if (identifiantEcran === 'ecran-liste') afficherListe();
  if (identifiantEcran === 'ecran-ajout') element('champ-fr').focus();
}

/* ═══════════════ ÉCRAN ACCUEIL ═══════════════ */

function rafraichirAccueil() {
  const tousLesMots = chargerMots();
  const aReviser = motsAReviser();

  element('nb-a-reviser').textContent = aReviser.length;
  element('btn-lancer-revision').disabled = (aReviser.length === 0);

  element('stat-total').textContent = tousLesMots.length;
  element('stat-acquis').textContent = tousLesMots.filter(function (mot) {
    return mot.niveau >= 5;
  }).length;
  element('stat-fragiles').textContent = tousLesMots.filter(function (mot) {
    return mot.niveau <= 1 && (mot.historique || []).length > 0;
  }).length;

  const info = element('info-prochaine');
  if (tousLesMots.length === 0) {
    info.textContent = 'Commence par ajouter tes premiers mots.';
  } else if (aReviser.length > 0) {
    info.textContent = '';
  } else {
    // Math.min sur toutes les dates : la révision la plus proche.
    const prochaineDate = Math.min.apply(null, tousLesMots.map(function (mot) {
      return mot.prochaineRevision;
    }));
    info.textContent = 'Rien à réviser. Prochain mot dans ' +
      formaterDelai(prochaineDate - Date.now()) + '.';
  }
}

/* ═══════════════ ÉCRAN AJOUT ═══════════════ */

element('formulaire-ajout').addEventListener('submit', function (evenement) {
  // Par défaut, un formulaire envoyé RECHARGE la page. Ici on veut
  // tout gérer nous-mêmes en JavaScript, donc on bloque ce réflexe.
  evenement.preventDefault();

  const francais = element('champ-fr').value.trim();
  const portugais = element('champ-pt').value.trim();
  if (!francais || !portugais) return;

  ajouterMot(francais, portugais, element('champ-note').value);

  // On vide le formulaire et on remet le curseur dans le premier champ,
  // pour pouvoir enchaîner les mots pendant le cours sans toucher l'écran.
  element('formulaire-ajout').reset();
  element('champ-fr').focus();

  const confirmation = element('confirmation-ajout');
  confirmation.textContent = '✓ « ' + francais + ' » ajouté';
  confirmation.hidden = false;
  clearTimeout(confirmation.minuterie);
  confirmation.minuterie = setTimeout(function () {
    confirmation.hidden = true;
  }, 2500);
});

/* ═══════════════ ÉCRAN LISTE ═══════════════ */

/** La couleur de la pastille selon la maîtrise du mot. */
function couleurPuce(mot) {
  if ((mot.historique || []).length === 0) return 'neuf';
  if (mot.niveau >= 5) return 'vert';
  if (mot.niveau >= 2) return 'orange';
  return 'rouge';
}

function afficherListe() {
  const recherche = normaliser(element('champ-recherche').value);

  const tousLesMots = chargerMots().sort(function (a, b) {
    return b.creeLe - a.creeLe; // les plus récents en premier
  });

  const motsAffiches = recherche === '' ? tousLesMots : tousLesMots.filter(function (mot) {
    return normaliser(mot.fr).indexOf(recherche) !== -1 ||
           normaliser(mot.pt).indexOf(recherche) !== -1;
  });

  element('sous-titre-liste').textContent =
    tousLesMots.length + (tousLesMots.length > 1 ? ' mots' : ' mot');

  const liste = element('liste-mots');
  liste.textContent = ''; // on vide avant de reconstruire
  element('liste-vide').hidden = (motsAffiches.length > 0);

  motsAffiches.forEach(function (mot) {
    const ligne = document.createElement('li');
    ligne.className = 'ligne-mot';

    const puce = document.createElement('span');
    puce.className = 'puce puce-' + couleurPuce(mot);

    const texte = document.createElement('div');
    texte.className = 'texte-mot';
    const titre = document.createElement('strong');
    titre.textContent = mot.fr;
    const traduction = document.createElement('small');
    traduction.textContent = mot.pt;
    texte.appendChild(titre);
    texte.appendChild(traduction);

    const boutonSupprimer = document.createElement('button');
    boutonSupprimer.className = 'btn-supprimer';
    boutonSupprimer.textContent = '🗑';
    boutonSupprimer.setAttribute('aria-label', 'Supprimer ' + mot.fr);
    boutonSupprimer.addEventListener('click', function () {
      if (confirm('Supprimer « ' + mot.fr + ' » ?')) {
        supprimerMot(mot.id);
        afficherListe();
      }
    });

    ligne.appendChild(puce);
    ligne.appendChild(texte);
    ligne.appendChild(boutonSupprimer);
    liste.appendChild(ligne);
  });
}

element('champ-recherche').addEventListener('input', afficherListe);

/* ═══════════════ ÉCRAN RÉVISION ═══════════════ */

function lancerRevision() {
  fileRevision = motsAReviser();
  if (fileRevision.length === 0) return;
  indexRevision = 0;
  afficherEcran('ecran-revision');
  afficherQuestion();
}

function afficherQuestion() {
  motActuel = fileRevision[indexRevision];
  scoreActuel = null;

  element('compteur-revision').textContent =
    (indexRevision + 1) + ' / ' + fileRevision.length;
  element('mot-question').textContent = motActuel.fr;

  const champ = element('champ-reponse');
  champ.value = '';
  champ.disabled = false;
  element('btn-verifier').hidden = false;
  element('bloc-resultat').hidden = true;
  champ.focus();
}

function verifierReponse() {
  // Sécurité : si le résultat est déjà affiché, on ne revérifie pas.
  if (!motActuel || !element('bloc-resultat').hidden) return;

  const score = comparerReponse(element('champ-reponse').value, motActuel.pt);

  element('champ-reponse').disabled = true;
  element('btn-verifier').hidden = true;
  element('bonne-reponse').textContent = motActuel.pt;

  const remarque = element('note-mot');
  remarque.textContent = motActuel.note ? '💡 ' + motActuel.note : '';
  remarque.hidden = (remarque.textContent === '');

  element('bloc-resultat').hidden = false;
  definirScore(score);
}

/** Affiche la note retenue. Appelée automatiquement, ou par les 3 pastilles. */
function definirScore(score) {
  scoreActuel = score;

  const textes = { vert: '🟢 Exact !', orange: '🟠 Presque !', rouge: '🔴 Raté' };
  const verdict = element('verdict');
  verdict.textContent = textes[score];
  verdict.className = 'verdict ' + score;

  document.querySelectorAll('.pastille').forEach(function (pastille) {
    pastille.classList.toggle('choisie', pastille.dataset.score === score);
  });

  element('prochain-delai').textContent =
    'Tu le reverras dans ' + formaterDelai(delaiApres(motActuel, score)) + '.';
}

function motSuivant() {
  appliquerResultat(motActuel, scoreActuel);
  enregistrerMot(motActuel);

  indexRevision++;
  if (indexRevision >= fileRevision.length) {
    afficherEcran('ecran-accueil');
  } else {
    afficherQuestion();
  }
}

element('formulaire-reponse').addEventListener('submit', function (evenement) {
  evenement.preventDefault();
  verifierReponse();
});

element('btn-suivant').addEventListener('click', motSuivant);
element('btn-lancer-revision').addEventListener('click', lancerRevision);
element('btn-quitter-revision').addEventListener('click', function () {
  afficherEcran('ecran-accueil');
});

document.querySelectorAll('.pastille').forEach(function (pastille) {
  pastille.addEventListener('click', function () {
    if (!element('bloc-resultat').hidden) definirScore(pastille.dataset.score);
  });
});

/* ═══════════════ BARRE DE NAVIGATION ═══════════════ */

document.querySelectorAll('.onglet').forEach(function (onglet) {
  onglet.addEventListener('click', function () {
    afficherEcran(onglet.dataset.cible);
  });
});

/* ═══════════════ DÉMARRAGE ═══════════════ */

afficherEcran('ecran-accueil');

// Le "service worker" permet à l'appli de fonctionner sans connexion.
// Il n'est disponible que sur un vrai site (https), pas en ouvrant le
// fichier directement depuis le disque — d'où la vérification.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(function (erreur) {
    console.warn('Service worker non installé :', erreur);
  });
}
