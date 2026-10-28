# France Travail — API Offres d’emploi

Le connecteur serveur est dans `server/ingestion/france-travail.js`. Aucun scraping, aucune clé navigateur, aucun jeton sur disque. L’ajout du connecteur ne prouve pas que les clés enregistrées dans Render fonctionnent : seule une collecte réussie le confirme.

## Configuration Render

Dans **Environment**, enregistrer les variables privées `FRANCE_TRAVAIL_CLIENT_ID` et `FRANCE_TRAVAIL_CLIENT_SECRET`, puis déployer le dernier commit de `offres-fraiches-v1`. `FRANCE_TRAVAIL_ENABLED=false` désactive la collecte. Ne jamais coller les secrets dans une conversation, un dépôt, une URL ou une variable `VITE_`.

Le serveur lance une collecte au démarrage et, par défaut, toutes les 180 minutes lorsqu’une API est configurée. Si `INGEST_INTERVAL_MINUTES=0` existe déjà, il désactive les répétitions : le remplacer par `180` pour des mises à jour périodiques. Minimum 5 minutes. Ne pas ajouter France Travail dans `SOURCES_FILE` : ce connecteur intégré utilise des destinations fixes et s’ajoute aux sources personnalisées.

L’application doit être inscrite et abonnée à l’API **Offres d’emploi** dans le [catalogue France Travail](https://francetravail.io/produits-partages/catalogue/offres-emploi). L’accès OAuth demande `api_offresdemploiv2 o2dsoffre`. Vérifier les droits effectifs, les quotas et les conditions de réutilisation acceptées dans l’espace partenaire. Conserver l’attribution France Travail, les dates et le lien original ; ne pas supprimer les obligations particulières des partenaires diffusant leurs offres via l’API. Les conditions de l’API priment ; aucune licence commerciale supplémentaire n’est supposée.

Destinations HTTPS utilisées :

- `entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire` : OAuth client credentials, secret transmis dans le corps POST uniquement.
- `api.francetravail.io/partenaire/offresdemploi/v2/offres/search` : recherche avec jeton Bearer en mémoire.

Autoriser ces domaines dans le réseau du serveur si la sortie Internet est filtrée. Le proxy d’environnement est respecté, les redirections ne sont pas suivies, les délais et volumes de réponse sont bornés. Les erreurs enregistrées utilisent des messages prédéfinis ; les réponses OAuth et les valeurs des clés ne sont jamais imprimées.

## Sélection et fiabilité

La recherche parcourt les codes ROME techniques déjà utilisés par LBA, par groupes de trois, avec les mots-clés `alternance`, `apprentissage` et `stage`. La sélection finale ne se fonde pas sur le mot-clé : elle exige un contrat structuré d’apprentissage, de professionnalisation, ou un type libellé stage. Un CDD ordinaire mentionnant le mot « alternance » est exclu. Le périmètre est volontairement non exhaustif.

Sont exclus : publication absente, future ou datant de plus de 45 jours ; domaines hors périmètre ; employeur anonyme ; lieu/région non établi ; annonce sans URL originale, titre ou description ; écoles/organismes de formation identifiés par leur nom ou leur code NAF 85. Ces règles prudentes peuvent écarter des annonces incomplètes. Elles ne constituent pas une certification de l’entreprise.

Les descriptions disponibles sont nettoyées, sans compléter les informations absentes. Les adresses e-mail et téléphones sont retirés ; les liens de candidature restent disponibles. Pas d’adresse personnelle collectée. Le site entreprise est absent si la source ne le fournit pas.

`dateCreation` reste la date de publication, `dateActualisation` la date de modification source, `lastFetchedAt` la date de collecte. Le statut `returned_by_api` signifie uniquement que l’offre figurait dans la réponse. `lastVerifiedAt` et la revue technique restent nuls : aucun badge de vérification humaine automatique.

L’API de recherche ne fournit pas de date d’expiration utilisable par ce connecteur : `sourceExpiresAt` reste nul. `expiresAt` est une échéance **locale** de conservation d’au plus deux jours, plafonnée par la fenêtre de 45 jours. Une nouvelle collecte renouvelle cette échéance uniquement pour les offres renvoyées. Une offre qui cesse d’être renvoyée disparaît à cette échéance, pas immédiatement : ce n’est pas une vérification individuelle en direct.

Les annonces éligibles suivent la politique de publication API autorisée du catalogue, comme LBA, et restent non revérifiées. Les dépôts d’entreprises et flux génériques restent soumis à la validation manuelle. Le connecteur ne permet pas aux déposants de contourner ces contrôles. Les retraits et refus administrateur ne sont jamais annulés par une collecte ultérieure. Le stockage existant dédoublonne par identifiant source, URL et titre/entreprise/lieu.

## Pagination et limites

150 résultats par page, `FRANCE_TRAVAIL_MAX_PAGES=3` par recherche par défaut (1–10). Les identifiants sont dédoublonnés entre recherches. Une pagination plafonnée est signalée dans le compte rendu privé. Le nombre total du marché n’est jamais revendiqué. Les requêtes sont séquentielles et espacées ; un 429 déclenche une seule reprise courte, puis une erreur explicite si le quota reste atteint. Un échec de collecte ne vide pas le catalogue existant ; les dates limites continuent à s’appliquer.

Le planificateur ne tourne que tant que le processus serveur tourne. Une instance Render gratuite en veille ne garantit pas une collecte régulière. Un disque persistant `DATA_DIR` reste nécessaire pour conserver le catalogue et les décisions.

## Confirmer la connexion

Dans les **Logs** Render :

- `Identifiants présents ; connexion API à tester par la collecte.` signifie uniquement que les variables sont présentes.
- `[France Travail] success` ou `partial`, suivi des compteurs, confirme une réponse traitée ; zéro offre reste possible après les exclusions.
- Un message d’authentification refusée : vérifier les identifiants et l’abonnement API.
- Accès non autorisé : vérifier les droits API de l’application.
- Quota atteint : patienter ou réduire le plafond de pages.
- Connexion indisponible : vérifier la sortie réseau et la disponibilité du service.

La page privée `/administration/`, section Sources, permet également de lancer une collecte et de lire son compte rendu. Aucun de ces diagnostics ne contient de secret. Il n’est pas nécessaire de transmettre les clés au développeur.

## Validation locale sans secrets

`npm test` utilise des réponses entièrement fictives en mémoire et des bases temporaires pour OAuth, cache, pagination, dédoublonnage, dates, contrats, exclusions, normalisation et retraits. Ces tests ne prouvent pas la connexion authentifiée de Render. Les variables Render ne sont pas accessibles depuis le workspace cloud.
