# Vocapp — mon carnet de vocabulaire

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

Les délais vont de 10 minutes (mot raté) à 3 mois (mot bien acquis).

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
| `js/app.js` | Le chef d'orchestre : réagit aux clics, affiche les écrans |
| `manifest.json` | Carte d'identité de l'appli (nom, icône) pour l'installer sur le téléphone |
| `sw.js` | Le « service worker » : permet à l'appli de fonctionner hors ligne |
| `serveur-local.js` | Outil de développement seulement — ne fait pas partie de l'appli |

Aucune bibliothèque extérieure, aucune installation : du HTML, du CSS et du
JavaScript que le navigateur exécute directement.

## Étapes du projet

- [x] **Palier 1** — appli perso, données stockées sur l'appareil
- [ ] **Palier 2** — compte en ligne + notifications push
- [ ] **Palier 3** — espace partagé professeur / élève

## Idées pour plus tard

- Réviser dans l'autre sens (portugais → français)
- Gérer plusieurs langues dans la même appli
- Écouter la prononciation
- Importer une liste depuis un fichier
