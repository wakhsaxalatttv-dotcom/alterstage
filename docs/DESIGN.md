# Système visuel — Offres Fraîches

## Tokens

`src/tokens.css` centralise l’ensemble des valeurs :

| Rôle | Token | Valeur |
| --- | --- | --- |
| Fond général | `--color-canvas` | `#F9FAFB` |
| Cartes | `--color-surface` | `#FFFFFF` |
| Fond de badge | `--color-surface-subtle` | `#F3F4F6` |
| Texte / accent | `--color-text`, `--color-accent` | `#0F172A` |
| Survol principal | `--color-accent-hover` | `#1E293B` |
| Texte secondaire | `--color-text-secondary` | `#475569` |
| Métadonnées | `--color-text-muted` | `#64748B` |
| Bordure | `--color-border` | `#E5E7EB` |
| Bordure survol | `--color-border-strong` | `#CBD5E1` |
| Contrôle daté | `--color-success` | `#047857` |
| Ombre survol | `--shadow-sm` | `0 1px 3px rgb(0 0 0 / .05)` |
| Panneau | `--shadow-panel` | `-8px 0 32px rgb(15 23 42 / .08)` |

La grille utilise les tokens `--space-1` à `--space-12`, de 4 à 48 px. Les rayons sont de 4, 8 et 12 px. La largeur maximale est de 1248 px ; la colonne des filtres mesure 240 px. Les interactions utilisent uniquement une transition de 120 ms et respectent `prefers-reduced-motion`.

Inter Variable reste auto-hébergée pour le texte. La pile monospace système SFMono / Consolas / Liberation Mono sert aux dates, niveaux et technologies, sans téléchargement supplémentaire. Aucune illustration générée ni aucun dégradé n’est utilisé.

`src/styles.css` conserve la structure existante et utilise les tokens communs. `src/premium.css` contient les règles de présentation du catalogue, des entreprises et des tiroirs ; elle est chargée après les styles structurels dans les deux entrées, publique et privée.

## Logos

`CompanyLogo` applique la même chaîne sur les cartes, l’annuaire et la fiche entreprise :

1. URL de logo HTTPS fournie par la source ou l’entreprise avec son autorisation existante.
2. Favicon du **domaine officiel renseigné**, via Google S2 en 128 px, sans clé API.
3. Monogramme SVG, immédiatement visible pendant le chargement et conservé si les images échouent.

Le cadre est fixe : 48 × 48 px sur ordinateur et 40 × 40 px dans les cartes mobiles, bordure légère et `object-fit: contain`. Les images utilisent le chargement différé, le décodage asynchrone et `referrerPolicy="no-referrer"`. Aucun domaine n’est deviné à partir du nom d’une entreprise ou du site de l’agrégateur. L’icône d’un domaine n’est pas présentée comme un logo certifié : son libellé accessible indique sa provenance. Pour une filiale dont seul le site du groupe est renseigné, l’icône représente ce site de groupe.

Le service de favicon reçoit le domaine et les informations réseau habituelles du navigateur. Il ne reçoit ni les filtres de recherche dans un référent ni un secret applicatif. Il ne garantit pas qu’un logo existe pour chaque société ; le monogramme est le repli normal. Un fournisseur de marque nécessitant une clé privée devrait passer par un connecteur serveur, jamais une variable publique Vite.

## Offres et confiance

La carte met le poste en premier, puis l’entreprise, le lieu, le contrat, le niveau, les technologies, la date et les actions. Le mode de travail est affiché uniquement pour un champ explicite `workMode` (`remote`, `hybrid`, `onsite` ou `on_site`), jamais déduit du lieu. Les données actuelles ne fournissent pas systématiquement ce champ.

Le badge **Vérifié** conserve le contrôle existant : statut actif et date de vérification réelle de moins de sept jours. Une ingestion API ou une simple consultation ne le déclenche pas. La limite de publication de 45 jours reste inchangée.

Les skeletons reprennent l’entête avec cadre de logo, les trois lignes d’information, les badges et les actions de la carte. Ils restent statiques pour éviter les mouvements inutiles. Les fiches d’offres et d’entreprises s’ouvrent dans un `dialog` natif présenté comme un tiroir de 680 px sur ordinateur et plein écran sur téléphone. Le clavier, Échap, la fermeture par le fond, le verrouillage du défilement et le retour du focus sont conservés.

## Validation

Avec `npm run dev` lancé et Chromium disponible, `npm run test:design` vérifie les trois étapes de logo, l’absence de faux statut, le mode de travail conditionnel, les skeletons, le tiroir, le retour du focus et les débordements de 320 à 1440 px. Les annonces fictives de ce test n’entrent que dans une base temporaire. Les tests de recherche, favoris, modération et signalements restent applicables.
