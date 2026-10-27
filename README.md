# Offres Fraîches

Première version mobile-first d’un catalogue français de stages et alternances. Projet initial vide ; architecture React 19 + Vite, serveur Express, JavaScript ESM. Node.js 24 recommandé (support natif des fichiers `.env`). Aucun compte ni paiement.

## Installation et lancement

```sh
npm ci --cache /tmp/offres-npm-cache
npm run dev
```

Exécuter dans le dossier du dépôt. Vite utilise le port 5173 et relaie `/api` au serveur Express sur 3001. Ouvrir l’interface du serveur Vite dans votre environnement de développement. Sans `.env`, l’application démarre normalement avec un catalogue vide et « Source non configurée ».

```sh
npm test
npm run build
npm start
```

En production, Express sert `dist` et `/api` sur `PORT` (3001 par défaut). Ne pas héberger seulement `dist` sans serveur API. Le proxy de développement suppose le port API 3001 ; si vous changez ce port, adapter la configuration du proxy. Pour installer, conserver le lockfile avec `npm ci`.

## Fonctionnalités

- Recherche texte et filtres combinables : région, domaine réellement reçu, niveau réellement reçu, type de contrat, date ; tri décroissant des dates connues.
- Cartes, détail et fiche entreprise à partir des données reçues uniquement ; lien de source et candidature officielle.
- Favoris, recherches/alertes et signalements dans `localStorage`, propres au navigateur et à l’origine du site. Aucun envoi d’e-mail ni notification en arrière-plan. Les signalements ne sont pas transmis ; un lien permet de contacter la source sur son site.
- Filtres repliables sur mobile, dialogue natif avec gestion clavier, états de chargement/erreur/vide.
- Aucun exemple fictif exposé dans l’application. Les données fictives de `test/` sont des fixtures isolées.

## Activer France Travail

1. Consulter [France Travail IO](https://francetravail.io/) et la documentation officielle de l’**API Offres d’emploi v2**. Créer une application et demander l’habilitation correspondante.
2. Lire et accepter les conditions d’utilisation, la licence de réutilisation, les obligations d’attribution, de protection des données et les limites de requêtes applicables à votre accès. Vérifier l’autorisation de republier les offres partenaires. L’implémentation ne constitue pas une autorisation ni un conseil juridique.
3. Copier `.env.example` vers `.env` localement, ou injecter les variables dans les paramètres sécurisés de l’hébergement : `FRANCE_TRAVAIL_CLIENT_ID` et `FRANCE_TRAVAIL_CLIENT_SECRET`. Ne jamais utiliser le préfixe `VITE_` pour un secret ni versionner `.env`.
4. Autoriser les sorties HTTPS vers `entreprise.francetravail.fr` (OAuth) et `api.francetravail.io` (API). Redémarrer le serveur après modification des variables.
5. Vérifier `GET /api/offers` et l’état de l’interface. Ne considérer la connexion comme validée qu’après une réponse authentifiée réussie. Les erreurs OAuth/réseau renvoient un état d’erreur sans secret au client.

Le connecteur utilise OAuth client credentials et le scope `api_offresdemploiv2 o2dsoffre`. Il interroge les types E1 (stage), E2 (apprentissage), FS (professionnalisation), avec 150 résultats maximum par type, triés selon l’API. Vérifier ces paramètres avec la documentation et l’habilitation accordée lors de l’activation. Il ne scrape aucun site. Le cache serveur dure cinq minutes, les requêtes simultanées sont regroupées, et chaque requête distante a un timeout de vingt secondes. Le serveur conserve la première date de récupération dans `.local/retrieval-history.json`, à persister lors d’un déploiement ; ne pas supprimer ce fichier si les dates doivent être conservées. Une erreur de lecture bloque le chargement plutôt que réinventer l’historique.

## Fiabilité et limites

Les champs manquants restent nuls ou masqués. La date de publication provient de `dateCreation` de la source ; elle n’est jamais remplacée par la date de récupération. L’API ne prouve pas que le recrutement reste ouvert : le connecteur laisse `lastVerifiedAt: null` et `status: to_verify`. Aucune annonce n’est marquée vérifiée. Une publication de plus de 30 jours est signalée comme ancienne. Les statuts expiré/retiré sont exclus de la recherche. Les favoris sont des copies locales, qui peuvent devenir obsolètes et sont signalées comme telles.

Les annonces sans entreprise, URL autorisée HTTP(S), titre ou contrat pris en charge sont exclues. Les annonceurs identifiables comme écoles/CFA/formation (nom ou secteur d’enseignement 85) sont exclus de façon conservatrice ; la détection n’est pas exhaustive. Les autres offres restent explicitement à vérifier, sans promesse d’authentification de l’entreprise. Prévoir une modération et une validation des annonceurs avant publication à grande échelle. Aucun contact n’est extrait : candidature par lien uniquement. La région est dérivée du code commune INSEE lorsque disponible ; aucune région n’est devinée depuis le texte libre. Les niveaux et domaines affichent les libellés de la source sans créer d’équivalences arbitraires. Déduplication par identifiant, URL, ou titre/entreprise/lieu normalisés.

Le catalogue est une sélection limitée, non une couverture exhaustive de la France. Pas de vérification automatique des pages de candidature, de pagination exhaustive, de synchronisation des suppressions entre sessions, de comptes, d’e-mail ni de notification. Pas de disponibilité certifiée des offres enregistrées. Les polices Google sont facultatives et possèdent des polices de repli locales.

## Organisation et évolutions

- `src/main.jsx` : écrans et navigation.
- `src/components.jsx` : composants réutilisables (filtres, cartes, état vide, dialogue).
- `src/storage.js` : adaptateur de stockage local versionné.
- `src/domain.js` : filtres, fraîcheur, correspondance des régions.
- `src/styles.css` : identité visuelle et responsive.
- `server/models.d.ts` : contrat de données et interfaces pour connecteurs/adaptateurs utilisateurs futurs.
- `server/france-travail.js` : logique spécifique à la source ; ajouter les prochaines API autorisées via ce contrat.
- `server/domain.js` : normalisation, sécurité des liens et déduplication.
- `server/history.js` : dates de première récupération persistées localement.
- `server/index.js` : façade API, cache et serveur de production.
- `test/` : contrôles des règles de fiabilité, filtres et connecteur simulé.

Le champ `sponsored` prépare l’étiquetage explicite des annonces sponsorisées, sans paiement ni priorité commerciale actuelle. Les interfaces d’adaptateurs permettent de migrer les données locales vers des comptes ; les futures notifications devront être délivrées par un service serveur avec consentement et désinscription. Ne jamais conditionner la recherche à un abonnement.
