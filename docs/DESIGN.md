# Apparence — Offres Fraîches

## Design restauré

L’interface reprend le design précédent : vert `#176B50`, fond crème `#FCFCF9`, cartes blanches et police Inter auto-hébergée. L’accroche « Votre avenir mérite des offres fraîches. » est conservée. Les filtres, l’ordre des informations et les fenêtres détaillées retrouvent leur disposition antérieure. Le thème ardoise, les métadonnées monospace et les tiroirs latéraux de la refonte ont été retirés.

`src/styles.css` contient le design restauré. `src/appearance.css` contient uniquement les ajouts de logos et d’animations.

## Identités visuelles

Le logo de l’application est une feuille blanche vectorielle sur fond vert (`public/brand-leaf.svg`). `AppLogo` le réutilise dans l’en-tête public et privé ; le navigateur utilise le même asset comme favicon. Aucun visuel généré ni logo de tiers n’est employé pour représenter l’application.

`CompanyLogo` est partagé entre cartes, annuaire et fiche entreprise :

1. Logo HTTPS fourni par une source ou une entreprise autorisée.
2. Favicon Google S2 du domaine officiel **déjà renseigné** ; aucun domaine n’est deviné.
3. Monogramme SVG si les images sont absentes ou échouent.

Le monogramme reste visible pendant le chargement pour éviter un cadre vide. La taille est fixe, avec `object-fit: contain`, chargement différé et `referrerPolicy="no-referrer"`. L’icône d’un domaine n’est pas présentée comme un logo certifié ; si seul le domaine d’un groupe est renseigné, son icône représente ce groupe. Le service distant reçoit le domaine et les informations réseau habituelles du navigateur, sans référent de recherche ni secret applicatif. Aucune clé Brandfetch ou autre n’est exposée côté client.

## Animations limitées

- Apparition des cartes au moment où elles entrent dans l’écran, en 560 ms et avec un déplacement de 14 px ; léger décalage pour les premières cartes. Un `IntersectionObserver` est déconnecté après la première apparition.
- Survol à la souris : carte soulevée de 4 px et ombre discrète ; boutons de 1 px.
- Favori : confirmation de 320 ms.
- Fenêtre : ouverture en 300 ms et fondu du fond.
- Logo : apparition de la feuille en 650 ms et fondu des logos d’entreprises après chargement.
- Sur téléphone : retour visuel à la pression des boutons ; les apparitions au défilement fonctionnent sans souris.

Pas de bibliothèque d’animation ajoutée. `prefers-reduced-motion: reduce` désactive ces effets. Les survols nécessitent un périphérique précis qui les supporte. Le dialogue natif conserve Échap, le verrouillage du défilement et le retour du focus après fermeture.

## Validation

`npm run test:design`, avec l’interface démarrée et Chromium disponible, vérifie les trois étapes de logo, le logo d’application chargé, la fenêtre et son focus, les largeurs de 320 à 1440 px et la réduction des animations. Les annonces fictives sont confinées à une base temporaire. La fiabilité des données, les badges de contrôle réel et la limite de 45 jours continuent d’être couverts par les tests existants.
