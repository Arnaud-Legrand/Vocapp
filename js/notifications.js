/* ═══════════════════════════════════════════════════════════
   NOTIFICATIONS — demander l'autorisation, afficher un rappel
   ───────────────────────────────────────────────────────────
   Étape 2a du projet : tout se passe encore SUR L'APPAREIL.
   On sait déjà afficher une notification, mais seulement quand
   l'appli est ouverte — car c'est elle qui doit la déclencher.

   Pour en recevoir quand l'appli est fermée, il faudra un
   serveur qui les envoie (étape 2b). Le service worker, lui,
   est déjà prêt : c'est lui qui les recevra.

   Deux règles d'Apple à connaître :
     1. les notifications web n'existent qu'à partir d'iOS 16.4 ;
     2. l'appli doit être ouverte DEPUIS L'ICÔNE de l'écran
        d'accueil, pas depuis un onglet Safari.
   ═══════════════════════════════════════════════════════════ */

/** Le navigateur sait-il faire des notifications ? */
function notificationsDisponibles() {
  return ('Notification' in window) && ('serviceWorker' in navigator);
}

/**
 * L'appli tourne-t-elle en mode « installée » (plein écran) ?
 * Sur iPhone c'est indispensable : dans un onglet Safari, Apple
 * refuse les notifications.
 */
function appliInstallee() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

/** Sommes-nous sur un appareil Apple ? */
function surIphone() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * L'état actuel, en un seul mot :
 *   'impossible'    le navigateur ne sait pas faire
 *   'a-installer'   iPhone, mais ouverte depuis Safari
 *   'a-demander'    tout est prêt, l'autorisation n'a pas été demandée
 *   'autorisees'    c'est bon
 *   'refusees'      refusé une fois ; seul iOS peut revenir dessus
 */
function etatNotifications() {
  if (!notificationsDisponibles()) return 'impossible';
  if (surIphone() && !appliInstallee()) return 'a-installer';

  if (Notification.permission === 'granted') return 'autorisees';
  if (Notification.permission === 'denied') return 'refusees';
  return 'a-demander';
}

/**
 * Demande l'autorisation à l'utilisateur.
 * ATTENTION : cet appel DOIT partir d'un vrai clic. Les navigateurs
 * refusent les demandes déclenchées toutes seules au chargement —
 * sinon chaque site visité ouvrirait une fenêtre dès l'arrivée.
 */
function demanderAutorisation() {
  if (!notificationsDisponibles()) return Promise.resolve('impossible');
  return Notification.requestPermission();
}

/**
 * Affiche une notification tout de suite.
 * On passe par le service worker plutôt que par `new Notification(...)` :
 * c'est la seule méthode qu'Apple accepte, et c'est aussi celle qui
 * servira quand les notifications viendront du serveur.
 */
function afficherNotification(titre, message, donnees) {
  return navigator.serviceWorker.ready.then(function (enregistrement) {
    return enregistrement.showNotification(titre, {
      body: message,
      icon: 'icons/icone-192.png',
      badge: 'icons/icone-192.png',
      lang: 'fr',
      // Deux notifications portant le même `tag` se remplacent au lieu
      // de s'empiler : on n'inonde pas l'écran de rappels identiques.
      tag: (donnees && donnees.tag) || 'vocapp',
      data: donnees || {}
    });
  });
}

/** Une notification d'essai, pour vérifier que tout fonctionne. */
function envoyerNotificationTest() {
  const dus = motsAReviser();
  const exemple = dus.length > 0 ? dus[0] : chargerMots()[0];

  if (!exemple) {
    return afficherNotification(
      'Vocapp',
      'Tout est prêt ! Ajoute des mots et je viendrai te les rappeler.',
      { tag: 'vocapp-test' }
    );
  }

  return afficherNotification(
    'Comment dit-on « ' + exemple.fr + ' » ?',
    'Touche pour répondre en portugais.',
    { tag: 'vocapp-test', motId: exemple.id }
  );
}
