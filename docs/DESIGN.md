# Interface Offres Fraîches

## Palette actuelle

La répartition demandée est un fond rouge et des panneaux verts, avec une écriture exclusivement dans des tons verts. Les palettes précédentes sont remplacées.

| Usage | Couleur |
| --- | --- |
| Fond général rouge clair | `#EB7770` |
| Texte sur fond rouge | `#103322` |
| En-tête et boutons vert forêt | `#103D29` |
| Cartes, filtres et formulaires | `#194B35` |
| Texte sur surfaces vertes | `#D1EDB8` |
| Champs et tags | `#286548` |

Le rouge est assez clair pour que le texte vert foncé reste lisible. Le vert occupe les cartes, les filtres, la recherche, l’en-tête et les actions. Les textes ne sont plus blancs ; les logos de tiers restent affichés tels que fournis.

Les couleurs sont centralisées dans `src/theme.css`. Inter Variable reste la typographie principale. La feuille est partagée par l’en-tête public, privé et le favicon. Aucun motif décoratif ni photographie n’est ajouté.

## Disposition et comportements

`src/responsive.css` conserve les cinq menus nommés sur téléphone, les champs de 16 px et les cibles tactiles principales de 44 px. Les filtres sont dépliables sur téléphone et regroupés dans un panneau sur ordinateur. Les cartes et fenêtres conservent leurs informations de source et leur logique métier.

`CompanyLogo` utilise le logo autorisé fourni, puis le favicon d’un domaine officiel déjà renseigné, puis un monogramme SVG. Aucun domaine n’est deviné. Les dimensions sont réservées et les images différées.

Les apparitions au défilement, la confirmation des favoris et l’ouverture des fiches restent désactivables avec `prefers-reduced-motion`. Les fenêtres natives conservent Échap et la restitution du focus. L’administration reste séparée et authentifiée.

## Validation

- `npm run test:responsive` : onze largeurs de 320 à 1920 px, navigation, filtres, formulaire, absence de débordement et couleurs du fond, de l’en-tête et du bouton de recherche.
- `npm run test:design` : logos, replis, fenêtres, focus et réduction des animations.
- `npm run build` : compilation publique et administration séparées.
