# Offres Fraîches

Stages et alternances techniques et informatiques en France. React 19, Vite, Express et **SQLite/FTS5 natif sous Node.js 24+**. Recherche gratuite ; aucun paiement. Le catalogue ne contient aucune offre fictive. **47 offres d’alternance reçues de La Bonne Alternance sont fournies dans un instantané daté**, sans clé dans le dépôt. Elles sont anciennes mais étaient encore actives dans la source lors de la collecte, et restent explicitement non revérifiées.

## Lancer dans Codespaces

Sur la branche `offres-fraiches-v1` :

```sh
npm ci
npm run setup:admin
npm run dev
```

Ouvrir le port **5173** dans l’onglet Ports. Vite relaie `/api` à Express sur 3001. La clé de modération aléatoire est créée dans `.env`, ignoré par Git et non affiché dans les logs. Ne pas la partager ; la saisir dans l’écran **Modération** (pied de page) depuis l’éditeur local. Une clé existante valide n’est pas remplacée. Sans clé, le catalogue démarre mais les dépôts publics sont fermés.

## Ce qui est disponible

- Catalogue entreprises enrichi, alimenté par les entreprises des offres importées et 19 pistes initiales dont ESN et spécialistes réseaux/télécoms, cloud et cybersécurité. Aucune taille, agence, stack, contact ou offre en cours n’est devinée. Les profils sont enrichis lors d’un dépôt validé, avec provenance.
- Recherche serveur indexée : mots-clés, ville, technologie mentionnée, région, famille/spécialité, formation, contrat et date ; pagination et vrai compteur global.
- Vue rapide à la demande : description, missions, compétences fournies, dates distinctes, source originale et candidature officielle. Badge de contrôle humain valable sept jours, distinct de l’extraction automatique.
- Dépôt entreprise avec aperçu, présentation et données enrichies sourcées, logo facultatif autorisé, contact générique RH/tutorat avec provenance. Une soumission reste privée avant revue.
- Modération paginée, revue, retrait, import éditorial et panneau Sources & collecte.
- Connecteurs JSON et RSS/Atom autorisés : normalisation, nettoyage, dédoublonnage, extraction de mentions, journal et collecte périodique optionnelle. Les modifications reviennent en attente.
- Favoris/alertes/signalements locaux. Pas d’e-mail, pas de notifications navigateur fermé, pas de transmission automatique des signalements. Une copie locale ne confirme pas la disponibilité actuelle.
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

Après **Manual Deploy → Deploy latest commit**, le catalogue initial de 47 alternances est chargé sans saisie de clé supplémentaire. Pour le tenir à jour, renseigner la véritable clé `LBA_API_KEY` dans les secrets Render (jamais la valeur de substitution du proxy cloud) ; sa valeur n’est pas transférée par GitHub. La clé configurée dans cet environnement cloud ne configure pas automatiquement Render.

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

La recherche affiche aussi une sélection distincte de six stages Safran, consultés le 27 octobre 2026, avec liens directs officiels et synthèses originales détaillant contexte, missions et profil. Ces références (`shared/external-offers.js`) suivent les filtres de recherche, sans augmenter le compteur du catalogue synchronisé. Les textes complets ne sont pas reproduits. Les dates de consultation ne constituent pas une vérification de disponibilité : aucun badge « vérifiée » n’est attribué. Cette sélection est manuelle, sans actualisation automatique ; vérifier régulièrement les liens et retirer les références fermées. Aucune durée, rémunération ou coordonnée manquante n’est déduite.
