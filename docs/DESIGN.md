# Interface Offres Fraîches

## Direction visuelle

Le propriétaire a demandé une nouvelle présentation professionnelle : vert forêt et gris pierre, sans photographies ni motifs de fond. Le slogan reste « Votre avenir mérite des offres fraîches. ». Le logo feuille est conservé dans `public/brand-leaf.svg`, sur fond vert forêt, et partagé avec la page privée et le favicon.

## Tokens

`src/theme.css` définit la palette commune :

| Token | Valeur | Usage |
| --- | --- | --- |
| `--surface` | `#F3F1EB` | Cartes, formulaires, en-tête |
| `--canvas` | `#E5E6DF` | Fond général |
| `--ink` / `--accent` | `#203E30` | Titres, navigation active, actions |
| `--muted` | `#56665B` | Métadonnées et texte secondaire |
| `--border` | `#D0D5C9` | Séparations et contours |
| `--shadow` | `0 1px 3px rgb(32 62 48 / .04)` | Relief discret des cartes |

Inter Variable reste la typographie principale. Les technologies gardent une police monospace système. Les badges de vérification utilisent le vert `#047857` sur fond `#ECFDF5` uniquement lorsque les données permettent de les afficher. Les erreurs conservent leurs couleurs distinctes. Le focus clavier vert reste visible.

## Disposition

L’accueil vert forêt et ses textes ivoire mènent à une barre de recherche puis à un catalogue sur fond gris pierre. Les filtres ont leur propre panneau minéral clair sur ordinateur. Les cartes légèrement teintées emploient des bordures fines, des titres contrastés et des tags neutres. Les composants Entreprises, Repérées, favoris, alertes et dépôt utilisent la même palette. La page privée reste séparée du site public et son contenu protégé.

La navigation conserve les cinq rubriques nommées sur téléphone. Les champs mobiles restent en 16 px et les contrôles principaux en 44 px minimum. `responsive.css` gère les passages entre mobile, tablette et ordinateur ; `theme.css` applique la palette et les finitions après ces règles.

## Logos et interactions

`CompanyLogo` utilise un logo autorisé fourni, puis le favicon d’un domaine officiel déjà renseigné, puis un monogramme SVG. Aucun domaine n’est deviné. Les images restent différées, avec dimensions réservées. Le fond des monogrammes est gris pierre.

L’apparition des cartes au défilement, la confirmation des favoris et l’ouverture des fenêtres sont conservées. Le survol des cartes est réduit à 2 px. `prefers-reduced-motion` désactive les animations. Les fenêtres natives conservent Échap, le verrouillage du défilement et la restitution du focus.

## Validation

- `npm run test:responsive` : menus, filtres mobiles, dépôt et absence de débordement sur onze largeurs de 320 à 1920 px, avec vérification du nouveau fond.
- `npm run test:design` : logos, replis, fenêtres, focus, responsive et réduction des animations.
- `npm run test:browser` : parcours de recherche, favoris, entreprises et modération dans un stockage isolé.
- `npm run build` : compilation publique et administration séparées.
