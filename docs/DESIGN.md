# Interface Offres Fraîches

La palette d’origine est rétablie : vert `#176B50`, fond crème `#FCFCF9`, texte `#253C34`, cartes et en-tête blancs. `src/styles.css` reprend le style d’origine. Les palettes rouges et sombres sont supprimées.

`src/original-theme.css` conserve uniquement le conteneur général, les monogrammes et la feuille décorative de l’accueil. La feuille reste grande à droite sur ordinateur et petite, à côté de l’accroche, sur téléphone. Le texte d’accueil ne mentionne plus les domaines.

`src/responsive.css` conserve les cinq rubriques nommées sur téléphone, les champs de 16 px et les principales cibles tactiles de 44 px. Les logos d’entreprises et les animations restent présents, avec respect de la réduction des mouvements. L’administration reste séparée et authentifiée.

Validation : `npm run test:responsive`, `npm run test:design` et `npm run build`.
