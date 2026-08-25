# Vocapp — mon carnet de portugais

Apprendre le vocabulaire de façon ludique avec une application mobile et un
système de notification tout au long de la journée, pour consolider ce qui a
été appris pendant les cours avec le professeur.

Le principe est celui de la **répétition espacée** : plus je connais un mot,
moins il revient souvent ; moins je le connais, plus il revient.

## Comment ça marche

1. Pendant le cours, j'ajoute les mots (français → portugais).
2. L'appli me réinterroge quand c'est le moment.
3. Je tape ma réponse, elle est notée automatiquement :
   - 🟢 **vert** : réponse exacte → le mot revient beaucoup plus tard
   - 🟠 **orange** : presque juste (accent oublié, une lettre) → le mot revient un peu plus tôt
   - 🔴 **rouge** : faux → le mot revient très vite

Les délais vont de 10 minutes (mot raté) à 2 semaines (mot bien acquis) :
10 min → 1 h → 4 h → 1 j → 2 j → 4 j → 7 j → 14 j. Le plafond est bas
volontairement : au-delà, un mot disparaîtrait trop longtemps de la
circulation.

Sur l’accueil, les mots sont répartis en trois familles :
**à revoir** (jamais réussi ou raté au dernier passage), **en cours**
(au moins une réussite), **acquis** (revient tous les 4 jours ou plus).

## Réviser quand j'en ai envie

Je peux lancer une session **à tout moment**, même quand rien n'est dû —
le bouton principal devient « Réviser quand même », et un lien « Réviser
d'autres mots » reste disponible le reste du temps. Ces sessions
d'**entraînement** partent des mots les moins bien sus.

Une règle importante s'y applique : **une bonne réponse en entraînement ne
fait pas monter le mot d'un niveau.** La répétition espacée repose sur le
fait de retrouver un mot *après* l'avoir un peu oublié ; s'interroger cinq
fois dans la même heure et monter à chaque fois ferait croire à l'appli que
le mot est acquis alors qu'il est juste frais en mémoire.

En revanche **une erreur compte toujours** : elle fait redescendre le mot et
le ramène rapidement, même en entraînement.

## Où sont enregistrés mes mots ?

Dans la mémoire du navigateur de l'appareil (`localStorage`), **et nulle part
ailleurs**. Conséquences à connaître :

- Mettre à jour l'appli ne touche **jamais** aux mots : le code et les données
  sont deux espaces séparés.
- Les mots saisis sur le téléphone n'apparaissent pas sur l'ordinateur, et
  inversement : ce sont deux mémoires distinctes.
- Supprimer l'appli de l'écran d'accueil efface ses données.

D'où le bloc **💾 Sauvegarde** en bas de l'écran « Ma liste » : *Exporter*
produit un texte à coller dans une note ou un e-mail, *Importer* le relit et
restaure les mots avec leur progression. Réimporter deux fois la même
sauvegarde ne crée pas de doublons.

La synchronisation automatique entre appareils arrivera au palier 2.

## Comment les mises à jour arrivent sur mon téléphone

Je n'ai **rien à désinstaller**. Quand une nouvelle version est publiée sur
GitHub Pages :

1. J'ouvre l'appli depuis l'icône de l'écran d'accueil.
2. Le service worker va voir en ligne s'il y a du neuf.
3. S'il y a du neuf, il l'installe et la page se recharge toute seule.

Le numéro de version affiché en bas de l'écran « Mon carnet » permet de
vérifier d'un coup d'œil que la mise à jour est bien arrivée. Si elle tarde,
fermer complètement l'appli (glisser vers le haut depuis le sélecteur d'apps)
et la rouvrir.

## Tester l'appli sur mon ordinateur

Un double-clic sur `index.html` suffit pour voir l'appli, mais le mode
hors-ligne et l'installation ne fonctionnent pas depuis une adresse
`file://`. Pour tester dans les vraies conditions :

```bash
node serveur-local.js
```

Puis ouvrir <http://localhost:8000>. Pour arrêter : `Ctrl + C`.

## Organisation des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La structure de la page : tous les écrans de l'appli |
| `css/style.css` | L'apparence : couleurs, tailles, mise en page |
| `js/stockage.js` | Lire et écrire les mots dans la mémoire du navigateur |
| `js/revision.js` | Le cerveau : comparer les réponses et calculer quand revoir un mot |
| `js/notifications.js` | Demander l'autorisation et afficher un rappel |
| `js/app.js` | Le chef d'orchestre : réagit aux clics, affiche les écrans |
| `manifest.json` | Carte d'identité de l'appli (nom, icône) pour l'installer sur le téléphone |
| `sw.js` | Le « service worker » : permet à l'appli de fonctionner hors ligne |
| `serveur-local.js` | Outil de développement seulement — ne fait pas partie de l'appli |

Aucune bibliothèque extérieure, aucune installation : du HTML, du CSS et du
JavaScript que le navigateur exécute directement.

## Étapes du projet

- [x] **Palier 1** — appli perso, données stockées sur l'appareil
- [ ] **Palier 2** — notifications et synchronisation
  - [x] **2a** — autorisation et notification de test (sans serveur)
  - [ ] **2b** — serveur qui envoie les rappels automatiquement
  - [ ] **2c** — synchronisation des mots entre iPhone et ordinateur
- [ ] **Palier 3** — espace partagé professeur / élève

### Notifications : ce qui marche aujourd'hui

L'écran **Réglages** demande l'autorisation et sait afficher une notification
de test. Deux règles d'Apple à connaître :

- les notifications web exigent **iOS 16.4** ou plus récent ;
- l'appli doit être ouverte **depuis son icône** sur l'écran d'accueil, jamais
  depuis un onglet Safari — sinon Apple les refuse.

Les rappels **automatiques** (quand l'appli est fermée) demandent un serveur :
une page web ne peut rien programmer toute seule une fois fermée. C'est
l'objet de l'étape 2b.

## Idées pour plus tard

- Réviser dans l'autre sens (portugais → français)
- Gérer plusieurs langues dans la même appli
- Écouter la prononciation
- Importer une liste depuis un fichier
