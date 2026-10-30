# France Travail — API Offres d’emploi

Le connecteur serveur est dans `server/ingestion/france-travail.js`. Aucun scraping, aucune clé navigateur, aucun jeton sur disque. L’ajout du connecteur ne prouve pas que les clés enregistrées dans Render fonctionnent : seule une collecte réussie le confirme.

## Configuration Render

Dans **Environment**, enregistrer les variables privées `FRANCE_TRAVAIL_CLIENT_ID` et `FRANCE_TRAVAIL_CLIENT_SECRET`, puis déployer le dernier commit de `offres-fraiches-v1`. `FRANCE_TRAVAIL_ENABLED=false` désactive la collecte. Ne jamais coller les secrets dans une conversation, un dépôt, une URL ou une variable `VITE_`.

Le serveur lance une collecte au démarrage et, par défaut, toutes les 180 minutes lorsqu’une API est configurée. Si `INGEST_INTERVAL_MINUTES=0` existe déjà, il désactive les répétitions : le remplacer par `180` pour des mises à jour périodiques. Minimum 5 minutes. Ne pas ajouter France Travail dans `SOURCES_FILE` : ce connecteur intégré utilise des destinations fixes et s’ajoute aux sources personnalisées.

L’application doit être inscrite et abonnée à l’API **Offres d’emploi** dans le [catalogue France Travail](https://francetravail.io/produits-partages/catalogue/offres-emploi). L’accès OAuth demande `application_<client_id> api_offresdemploiv2 o2dsoffre` : le préfixe d’application est construit automatiquement avec l’identifiant client serveur, sans variable supplémentaire. Vérifier les droits effectifs, les quotas et les conditions de réutilisation acceptées dans l’espace partenaire. Conserver l’attribution France Travail, les dates et le lien original ; ne pas supprimer les obligations particulières des partenaires diffusant leurs offres via l’API. Les conditions de l’API priment ; aucune licence commerciale supplémentaire n’est supposée.

Destinations HTTPS utilisées :

- `entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire` : OAuth client credentials, secret transmis dans le corps POST uniquement.
- `api.francetravail.io/partenaire/offresdemploi/v2/offres/search` : recherche avec jeton Bearer en mémoire.

Autoriser ces domaines dans le réseau du serveur si la sortie Internet est filtrée. Le proxy d’environnement est respecté, les redirections ne sont pas suivies, les délais et volumes de réponse sont bornés. Les erreurs enregistrées utilisent des messages prédéfinis ; les réponses OAuth et les valeurs des clés ne sont jamais imprimées.

## Sélection et fiabilité

La recherche parcourt les 1 584 codes métiers du référentiel ROME v4.60, dans tous les secteurs, sur les publications des 45 derniers jours. Le référentiel complet, ses libellés et sa provenance figée sont conservés dans `config/france-travail-rome.json`. Les spécialisations techniques existantes sont préservées ; les familles de commerce, santé, services, agriculture et gestion sont désormais admises. Un curseur SQLite reprend au prochain métier en cas de budget atteint, sans effacer la couverture partielle déclarée.

Aucun mot-clé de titre n’est exigé : une offre dont le titre ne mentionne pas « alternance » peut être retenue. La sélection exige un contrat structuré d’apprentissage, de professionnalisation, ou un type libellé stage ; une alternance structurée sans sous-type reste identifiée comme telle. Un CDD ordinaire mentionnant le mot « alternance » est exclu.

Sont exclus : publication absente, future ou datant de plus de 45 jours ; domaines hors périmètre ; employeur anonyme ; lieu/région non établi ; annonce sans URL originale, titre ou description ; écoles/organismes de formation identifiés par leur nom ou leur code NAF 85. Ces règles prudentes peuvent écarter des annonces incomplètes. Elles ne constituent pas une certification de l’entreprise.

Les descriptions disponibles sont nettoyées, sans compléter les informations absentes. Les adresses e-mail et téléphones sont retirés ; les liens de candidature restent disponibles. Pas d’adresse personnelle collectée. Le site entreprise est absent si la source ne le fournit pas.

`dateCreation` reste la date de publication, `dateActualisation` la date de modification source, `lastFetchedAt` la date de collecte. Le statut `returned_by_api` signifie uniquement que l’offre figurait dans la réponse. `lastVerifiedAt` et la revue technique restent nuls : aucun badge de vérification humaine automatique.

L’API de recherche ne fournit pas de date d’expiration utilisable par ce connecteur : `sourceExpiresAt` reste nul. `expiresAt` est une échéance **locale** de conservation d’au plus deux jours, plafonnée par la fenêtre de 45 jours. Une nouvelle collecte renouvelle cette échéance uniquement pour les offres renvoyées. Une offre qui cesse d’être renvoyée disparaît à cette échéance, pas immédiatement : ce n’est pas une vérification individuelle en direct.

Les annonces éligibles suivent la politique de publication API autorisée du catalogue, comme LBA, et restent non revérifiées. Les dépôts d’entreprises et flux génériques restent soumis à la validation manuelle. Le connecteur ne permet pas aux déposants de contourner ces contrôles. Les retraits et refus administrateur ne sont jamais annulés par une collecte ultérieure. Le stockage existant dédoublonne par identifiant source, URL et titre/entreprise/lieu.

## Pagination et limites

150 résultats par page, `FRANCE_TRAVAIL_MAX_PAGES=10` par fenêtre (1–10). Lorsqu’une fenêtre contient davantage de résultats, elle est automatiquement divisée en deux périodes, jusqu’à la seconde si nécessaire, et toutes les pages des sous-périodes sont parcourues. Les frontières temporelles se recouvrent pour ne pas perdre les offres au point de découpe ; leurs identifiants sont dédoublonnés. Un ancien réglage à trois pages déclenche ce même découpage et ne limite donc plus la collecte à trois pages au total.

Le budget `FRANCE_TRAVAIL_MAX_REQUESTS` vaut 2000 requêtes de recherche par exécution (1–5000). Les reprises OAuth/429 comptent aussi dans ce budget. Les requêtes sont séquentielles et espacées de 200 ms au minimum ; un 429 déclenche une seule reprise courte. Les offres non éligibles sont éliminées à chaque page pour limiter la mémoire du serveur.

La couverture de métiers, la période recherchée et les limites sont conservées dans le compte rendu privé. Une seconde contenant plus de résultats que le plafond API, une pagination incohérente, un quota, un budget atteint ou une interruption réseau ne sont jamais présentés comme un parcours complet. Lorsqu’une interruption de quota/réseau survient après des réponses exploitables, les offres éligibles déjà reçues sont conservées et l’exécution est explicitement partielle. Les dates limites et les retraits administrateur restent appliqués. Le compteur de lignes examinées et d’exclusions porte sur des observations de réponses, potentiellement répétées aux frontières ; il ne représente pas un total unique du marché.

Même un parcours terminé concerne une période et un périmètre donnés, pas une garantie d’exhaustivité du marché mouvant ni de disponibilité individuelle en direct.

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

### Diagnostic OAuth précis

Les erreurs d’authentification indiquent désormais le statut HTTP et, si fourni, un code standard reconnu uniquement. `invalid_client` oriente vers le couple d’identifiants de la même application ; `invalid_scope` ou `unauthorized_client` vers les droits/abonnements API. Les champs `error_description`, réponses arbitraires, jetons, secrets et URL de redirection ne sont jamais repris dans les logs. Une erreur serveur HTTP 5xx est distinguée d’un rejet des identifiants. Une présence de variables ne prouve jamais la validité des clés.

### Correction du scope d’application

La requête inclut désormais le scope `application_<client_id>`, qui manquait dans la première implémentation. La valeur utilise exactement le même identifiant nettoyé que le champ OAuth `client_id`, sans ajouter le secret au scope ni aux logs. Aucun changement de clé ou de nom de variable n’est nécessaire pour appliquer cette correction.

Le format a été contrôlé dans le [client France Travail utilisé par La Bonne Alternance](https://github.com/mission-apprentissage/labonnealternance/blob/910832b066380101b119eb336430cb12ed4efc33/server/src/common/apis/france-travail/france-travail.client.ts). La correction se vérifie avec les réponses fictives en test ; son résultat réel reste à confirmer dans Render après déploiement.
