# Offres Fraîches

Stages et alternances techniques et informatiques en France. React 19, Vite, Express et **SQLite/FTS5 natif sous Node.js 24+**. Recherche gratuite ; aucun paiement. Le catalogue ne contient aucune offre fictive. **11 offres d’alternance reçues de La Bonne Alternance sont fournies dans un instantané daté**, sans clé dans le dépôt. Seules les publications datant de 45 jours maximum sont visibles, même après synchronisation ; les offres restent explicitement non revérifiées.

## Lancer dans Codespaces

Sur la branche `offres-fraiches-v1` :

```sh
npm ci
npm run setup:admin
npm run dev
```

Ouvrir le port **5173** dans l’onglet Ports. Vite relaie `/api` à Express sur 3001. La clé de modération aléatoire est créée dans `.env`, ignoré par Git et non affiché dans les logs. Ne pas la partager ; la saisir dans l’espace séparé **`/administration/`**, sans lien sur le site public depuis l’éditeur local. Une clé existante valide n’est pas remplacée. Sans clé, le catalogue démarre mais les dépôts publics sont fermés.

## Ce qui est disponible

- Catalogue entreprises enrichi, alimenté par les entreprises des offres importées et 19 pistes initiales dont ESN et spécialistes réseaux/télécoms, cloud et cybersécurité. Aucune taille, agence, stack, contact ou offre en cours n’est devinée. Les profils sont enrichis lors d’un dépôt validé, avec provenance.
- Recherche serveur indexée : mots-clés, ville, technologie mentionnée, région, famille/spécialité, formation, contrat et date ; pagination et vrai compteur global.
- Vue rapide à la demande : description, missions, compétences fournies, dates distinctes, source originale et candidature officielle. Badge de contrôle humain valable sept jours, distinct de l’extraction automatique.
- Dépôt entreprise avec aperçu, présentation et données enrichies sourcées, logo facultatif autorisé, contact générique RH/tutorat avec provenance. Une soumission reste privée avant revue.
- Modération paginée, revue, retrait, import éditorial et panneau Sources & collecte.
- Connecteurs JSON et RSS/Atom autorisés : normalisation, nettoyage, dédoublonnage, extraction de mentions, journal et collecte périodique optionnelle. Les modifications reviennent en attente.
- Favoris et alertes locaux, sans e-mail ni notification navigateur fermé. Les nouveaux signalements sont transmis au serveur et traités dans l’espace Gestion ; les anciens signalements locaux ne sont pas récupérés automatiquement.
- UI responsive, skeletons, police auto-hébergée, écrans employeur/modération découpés en chargement différé et logos autorisés en lazy loading.

## Architecture et alimentation

Le plan par étapes, le schéma et les compromis sont dans **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. Les champs et interfaces se trouvent dans `server/models.d.ts`.

Le guide **[docs/INGESTION.md](docs/INGESTION.md)** explique les flux, les conditions d’autorisation, les variables et la revue. `config/sources.example.json` est vide volontairement. Le serveur charge au démarrage `config/market-offers.json` dans sa base, y compris sur Render sans clé API. Il ne prétend pas être connecté en direct sans clé. Voir aussi [config/DATA_LICENSE.md](config/DATA_LICENSE.md). France Travail reste désactivé, sans clé requise. Les liens Google de l’annuaire sont des pistes de recherche, pas des sources de postes confirmés ou des partenariats.

## Tests et production

```sh
npm test
npm run build
npm start
```

Pour les parcours navigateur, avec le serveur de développement déjà lancé :

```sh
# Si Chromium n’est pas déjà installé sur la machine :
npx playwright install chromium
npm run test:browser
```

`BASE_URL` peut remplacer l’adresse de test par défaut et `BROWSER_EXECUTABLE` le chemin de Chromium. Les tests navigateur utilisent une API isolée et un dossier temporaire ; aucun dépôt fictif n’est inséré dans le catalogue réel. Les tests unitaires/intégration couvrent notamment migration, filtres/index, cache, provenance, droits, collectes rejouées et modération.

Express sert l’application compilée et l’API sur `PORT` (3001 par défaut). GitHub Pages seul ne peut pas exécuter les dépôts et le serveur.

### Render

Après **Manual Deploy → Deploy latest commit**, l’instantané de 11 alternances de moins de 46 jours est chargé sans saisie de clé supplémentaire. Pour le tenir à jour, renseigner la véritable clé `LBA_API_KEY` dans les secrets Render (jamais la valeur de substitution du proxy cloud) ; sa valeur n’est pas transférée par GitHub. La clé configurée dans cet environnement cloud ne configure pas automatiquement Render.

- Branche `offres-fraiches-v1`, Node **24** (variable `NODE_VERSION=24`), Build `npm ci && npm run build`, Start `npm start`.
- `ADMIN_TOKEN` : secret serveur aléatoire d’au moins 32 caractères, à renseigner dans les paramètres sécurisés de l’hébergeur. Génération locale possible avec `openssl rand -hex 32`. Ne pas utiliser de variable `VITE_`, commiter `.env` ni publier cette clé.
- **Disque persistant indispensable** : monter un disque, par exemple sur `/var/data`, et définir `DATA_DIR=/var/data/offres-fraiches`. Ce chemin est un exemple de point de montage, à adapter à votre service. Vérifier le tarif de l’hébergeur avant d’ajouter un disque. Un disque éphémère perd les dépôts et les profils lors des redéploiements.
- Utiliser HTTPS, garder les sauvegardes hors du disque principal et tester leur restauration. Les assets hashés sont mis en cache ; les données d’offres ne sont pas conservées dans le cache navigateur.

Au premier démarrage, les dépôts existants de `DATA_DIR/offers.json` migrent automatiquement dans une transaction vers `catalogue.sqlite`, sans effacer le JSON. Sauvegarder l’ancien répertoire avant mise à jour. Ensuite seul SQLite est utilisé. Sauvegarder une base active avec une méthode SQLite cohérente (incluant la gestion du WAL), pas une simple copie isolée du fichier principal pendant les écritures.

## Limites d’exploitation actuelles

Cette version prépare un **pilote de production sur une instance avec disque local persistant**, pas un SaaS distribué complet. L’accès administrateur reste un jeton unique ; comptes, rôles et MFA ne sont pas implémentés. Pas de vérification automatique de l’identité déposant, de notification, de paiement, de suivi automatique des fermetures distantes ni de garantie d’exhaustivité. Les contacts personnels ne sont pas collectés ; seuls les contacts génériques publics autorisés sont admis.

Les collectes exigent des sources accessibles et une autorisation réelle. Le connecteur LBA est actif lorsque `LBA_API_KEY` est fourni sur le serveur. Il s’exécute au démarrage puis toutes les trois heures par défaut (`LBA_ENABLED=false` pour le désactiver). Les annonces LBA filtrées peuvent être affichées selon la politique source, avec `lastVerifiedAt=null` et l’avertissement de disponibilité à confirmer. Les dépôts et autres flux conservent leur modération habituelle. Une disponibilité vérifiée est ponctuelle, pas une promesse future.

SQLite WAL convient au disque local d’une machine. Plusieurs instances sur des disques différents demandent une base partagée (par exemple PostgreSQL), un cache et un planificateur distribués. Les requêtes synchrones doivent être mesurées sur la charge réelle. La limitation des dépôts reste à cinq tentatives par heure par adresse vue par Express : derrière un proxy, plusieurs utilisateurs peuvent partager cette adresse. Prévoir une politique de proxy de confiance, protections antispam et supervision adaptées avant une ouverture à grande échelle.

### Liens employeurs et synthèses éditoriales

L’onglet **Repérées**, à côté des offres et des entreprises, présente une sélection distincte de 30 stages éligibles au 27 octobre 2026 : six références initiales Safran, neuf références du groupe VINCI et quinze stages de chimie, procédés et matériaux. Un ancien lien Java du 7 septembre a été retiré. Les pages ont été consultées le 27 octobre 2026. Les fiches comportent liens officiels et synthèses originales détaillant contexte, missions, profil et entreprise. Les durées, débuts et conditions sont affichés lorsqu’ils sont fournis. Les filtres propres à cette page combinent mot-clé/entreprise, région, domaine, technologie, formation et publication ; le tri conserve la vraie date visible de publication.

Les références sont dans `shared/external-offers.js`, `shared/employer-references.js` et `shared/chemistry-references.js`, sans augmenter le compteur du catalogue synchronisé. Les textes complets ne sont pas reproduits. Certaines pages VINCI présentent un `datePosted` structuré plus récent que leur publication visible : `publishedAt` conserve la date visible et `sourceMetadataDate` préserve séparément la métadonnée, expliquée dans la fiche. Les anciennes annonces gardent leur avertissement. La date de consultation ne constitue pas une vérification de disponibilité : aucun badge « vérifiée » n’est attribué. La sélection est manuelle, sans actualisation automatique ; vérifier régulièrement les liens et retirer les références fermées. Aucune coordonnée ou condition manquante n’est déduite.

Avec le serveur de développement démarré, `npm run test:references` contrôle dans Chromium l’onglet Repérées sur mobile et ordinateur, les nouvelles fiches, leurs liens employeurs, les filtres combinés, les dates anciennes et l’état vide. Le test simule une source de catalogue indisponible tout en servant la liste éditoriale via son endpoint dédié.

### Limite de fraîcheur et accès supplémentaires

La règle partagée `shared/freshness.js` exclut de l’affichage toute publication de plus de 45 jours (45e jour inclus), sans date valide ou datée dans le futur. Elle s’applique aux listes, compteurs, détails API, offres liées aux entreprises, favoris affichés et références éditoriales. La date de consultation ne prolonge jamais la publication. Les anciennes données privées peuvent rester en base pour conserver l’historique de modération, mais ne sont plus publiques. L’instantané distribué est également nettoyé ; les références vieillissent automatiquement hors de l’affichage.

La clé LBA existante suffit pour le connecteur actuel, désormais étendu aux codes ROME H1503 (laboratoire d’analyse industrielle) et H2301 (production chimique/pharmaceutique). La collecte du 27 octobre n’a fourni aucune nouvelle offre chimie éligible ; les quinze nouveaux stages sont des références éditoriales officielles, sans flux automatique. Aucune clé n’est nécessaire pour ces liens publics.

Pour une extension future, Adzuna demande un `app_id` et une `app_key` (https://developer.adzuna.com/), sous réserve des conditions de diffusion et d’un connecteur à développer. Les employeurs et logiciels de recrutement peuvent aussi fournir un flux autorisé ou un accès API : il n’existe pas de clé universelle donnant accès à toutes les annonces des entreprises ou de LinkedIn. Ne jamais transmettre de secrets dans le chat : les configurer côté serveur et dans Render uniquement après choix de la source.

### Présentation des annonces

Les cartes et fiches affichent la date de publication, sans les anciens encarts de fraîcheur ni les lignes de vérification non effectuée. La limite de 45 jours continue de s’appliquer automatiquement ; aucune vérification n’est inventée. La présentation reprend les couleurs d’origine vert et crème, des cartes sobres, une typographie lisible et des actions de candidature visibles. Aucun visuel généré ni bandeau décoratif n’est utilisé.

### Gestion des dépôts et signalements

1. Sur Render, configurer `ADMIN_TOKEN` dans **Environment** avec un secret aléatoire d’au moins 32 caractères, puis redéployer. Le jeton local du cloud n’est pas automatiquement transféré à Render. Ne pas saisir ce secret dans le chat ni dans une variable `VITE_`.
2. Ouvrir directement **`https://votre-site/administration/`** et saisir ce jeton dans « Code d’accès ». Aucun lien d’administration n’apparaît dans la navigation ni le pied de page publics. Les consignes sont réservées à la session connectée. Il reste uniquement en mémoire jusqu’à la déconnexion ou au rechargement.
3. Dans **À valider**, contrôler la source, les droits de diffusion, l’entreprise, les dates et contacts. Cocher les quatre attestations puis choisir **Valider et publier**, ou **Refuser**. Les dépôts d’entreprises sont privés et ne peuvent pas s’auto-publier.
4. Dans **Signalements**, consulter le motif, les précisions, la date et l’annonce officielle. Ajouter une note privée puis marquer le signalement comme traité, le classer sans suite ou retirer l’annonce du site. Aucun signalement n’entraîne un retrait automatique.

Les nouveaux signalements et décisions sont enregistrés en SQLite dans `DATA_DIR` (tables créées automatiquement au démarrage). Pour les conserver sur Render, un disque persistant est nécessaire ; une base sur un disque éphémère peut disparaître au redéploiement. Le retrait d’une référence éditoriale est aussi persistant et la liste `/api/references` applique ces décisions : le navigateur ne réaffiche pas une copie statique si le service de références est indisponible. Les signalements ne sont lisibles qu’avec le jeton administrateur. Les anciennes copies locales des visiteurs ne peuvent pas être rapatriées automatiquement et ne sont pas annoncées comme reçues.

Les formulaires de signalement existent sur les fiches du catalogue et de Repérées. Ils ne demandent aucune coordonnée personnelle et sont limités à dix envois par heure et par adresse cliente. Sur Render, Express fait confiance au dernier proxy pour identifier cette adresse. Les notes sont privées ; aucun e-mail n’est envoyé à l’employeur. `npm run test:reports` vérifie le parcours visiteur → gestion authentifiée → retrait dans une base temporaire.

Les raccourcis **Repérées** présentent tous les domaines actuellement représentés, en plus du menu complet. « Chimie & matériaux » est désormais un raccourci parmi les autres ; tous les filtres combinés restent disponibles.

L’administration utilise une entrée HTML et un bundle JavaScript distincts. Sa page de connexion ne contient aucune consigne Render ni nom de variable secrète. Elle porte une directive `noindex` ; cette directive et l’absence de lien ne remplacent pas l’authentification obligatoire des API privées.

### Diagnostic d’accès administrateur sur Render

Dans les **Logs** privés du service, rechercher `[Administration]` après un déploiement. Le démarrage indique uniquement si `ADMIN_TOKEN` est absent, trop court ou reçu et valide en longueur. La valeur, sa longueur exacte et les autres variables ne sont jamais affichées. Ces informations ne sont pas ajoutées à l’API publique ni à la page de connexion. Un message « accès privé activé » confirme le chargement de la configuration, pas la validité d’un code saisi par un visiteur.

### Logos et animations

Le design vert et crème et l’accroche d’origine sont conservés. Le symbole de l’application est dans `public/brand-mark.svg`, réutilisé par `AppLogo` et comme favicon. `CompanyLogo` affiche le logo fourni, puis l’icône du domaine officiel renseigné, puis un monogramme SVG si nécessaire. Aucun domaine n’est deviné et aucune clé d’accès n’est requise.

`src/appearance.css` limite les ajouts aux cadres de logo et aux micro-interactions : apparition courte des cartes, survol léger, confirmation du favori et ouverture de fenêtre. Ces effets sont désactivés avec `prefers-reduced-motion`; les survols sont réservés aux périphériques adaptés. Les filtres, la modération privée, les signalements et la limite de 45 jours restent inchangés. `npm run test:design` contrôle les replis des logos, la fenêtre et le retour de focus, le responsive et la réduction des animations. Voir [docs/DESIGN.md](docs/DESIGN.md).
