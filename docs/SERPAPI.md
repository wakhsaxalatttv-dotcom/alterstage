# Google Jobs : collecte, analyse et publication automatiques

## Configuration

Définir `SERPAPI_API_KEY` côté serveur Render, puis déployer le code. La clé ne doit jamais être préfixée `VITE_` ni être copiée dans le navigateur ou le dépôt. Aucun passage dans Sources pour lancer un import n’est nécessaire. L’espace privé affiche seulement le suivi de l’automatisation Google Jobs.

Le serveur démarre la rotation avec sa clé existante, puis vérifie toutes les minutes si une nouvelle recherche est due. `SERPAPI_AUTO_ENABLED=false` permet de désactiver ce processus. L’ancien import initial unique n’est plus exécuté. Les anciens endpoints de diagnostic et de préparation restent privés pour compatibilité, mais leurs commandes ne sont plus proposées dans l’interface. RapidAPI/LinkedIn reste limité à son diagnostic privé, sans collecte automatique ni abonnement supposé.

## Couverture et quota

`shared/serpapi-searches.js` définit **42 recherches : stage et alternance pour chacun des 21 domaines du site**, dont informatique, réseaux, télécoms, électronique, mécanique, maintenance, énergie, génie civil, aéronautique et chimie. Les domaines sont ceux de la recherche existante ; aucun domaine commercial ou école n’est ajouté.

Chaque recherche utilise une page de `engine=google_jobs`, `location=France`, `gl=fr`, `hl=fr` via SerpApi. La découverte ne prétend pas collecter toutes les offres du marché et ne pagine pas sans limite. Le domaine de la requête ne suffit jamais à classer une annonce : l’analyse porte sur le poste reçu.

Le budget par défaut est **un appel au plus toutes les 20 minutes, trois par heure et 24 par jour UTC**. Il est persistant dans SQLite, ainsi que l’avancement et les pauses. Il n’est pas remis à zéro par un redémarrage utilisant la même base. Une recherche réussie est renouvelée après **7 jours**. La rotation couvre progressivement tous les domaines ; elle n’est donc pas instantanée et dépend de la disponibilité du serveur et du quota du compte. Sur une instance Render en sommeil, les minuteurs ne tournent pas ; la rotation reprend au réveil.

Variables optionnelles :

- `SERPAPI_AUTO_ENABLED=true` : activation, par défaut.
- `SERPAPI_DAILY_REQUEST_LIMIT=24` : maximum quotidien, borné entre 1 et 200, en conservant le plafond de trois appels/heure.
- `SERPAPI_REFRESH_DAYS=7` : renouvellement entre 1 et 30 jours.

Adapter le budget au forfait réel ; ce code ne confirme pas les tarifs ni le solde du compte. Une réponse 429 suspend la rotation 24 heures, une clé refusée la suspend six heures, une autre erreur une heure. Les recherches suivantes reprennent automatiquement. Un verrou et le budget partagé empêchent deux processus utilisant la même base de lancer simultanément une requête. Un disque persistant reste nécessaire : supprimer la base efface aussi les budgets et l’historique.

## Analyse et publication

1. Exclure Meteojob (fournisseur, provenance, lien original, lien de candidature, redirection ou option Google Jobs), les écoles identifiées, les CDI/freelances et les titres sans mention de stage/alternance/apprentissage.
2. Conserver les vrais titre, entreprise, lieu, description disponible et liens HTTPS. Nettoyer HTML actif et contacts ; ne pas recopier un logo ou une présentation d’entreprise sans provenance autorisée.
3. Exiger une **publication dont l’ancienneté peut être établie dans les 45 jours**. Les dates ISO structurées et les extensions portant une date ISO explicite sont reconnues. Les indications relatives numériques en français ou anglais (« il y a 3 jours », « 2 weeks ago ») sont conservées avec leur vraie date de relevé. Elles définissent un intervalle prudent tenant compte des arrondis ; la publication n’est admise que si tout cet intervalle respecte la limite. Les mois, les indications ouvertes (« 30+ days ago »), les valeurs ambiguës, futures ou trop anciennes ne permettent pas cette admission. Une date totalement absente reste bloquante.
4. Déterminer le domaine avec des règles transparentes sur le titre et la description, sans utiliser la requête comme preuve. Rejeter les fonctions commerciales/RH identifiées. Les technologies mentionnées sont extraites sans inventer de stack d’entreprise.
5. Reconnaître le contrat dans l’intitulé ou les métadonnées structurées : stage, apprentissage ou professionnalisation. Une alternance dont le sous-type n’est pas fourni est affichée comme **« Alternance — type non précisé »**, jamais transformée en apprentissage. Les filtres distinguent cette valeur des sous-types confirmés.
6. Exiger une localisation mentionnant la France, puis résoudre la commune par l’API géographique officielle `geo.api.gouv.fr`, sans clé, avec correspondance exacte et unique. Une ville ambiguë, étrangère, un simple télétravail ou un échec réseau ne deviennent pas une région française inventée. Les résultats géographiques sont mis en cache ; aucun site carrière n’est scrappé.
7. Normaliser via le modèle existant, dédoublonner et insérer les fiches admissibles directement dans **Offres**. Conserver la source Google Jobs via SerpApi, la date d’origine et le lien de candidature. Le site de l’entreprise reste inconnu s’il n’est pas fourni ; le domaine d’un job board ne devient pas son site officiel.

La publication automatique marque l’admissibilité aux règles du catalogue, **pas une vérification humaine de disponibilité**. `lastVerifiedAt` et `technicalReviewAt` restent nuls, sans faux badge « Vérifié ». Les retraits et refus antérieurs sont conservés. Une fin de validité locale d’environ une semaine depuis récupération et la limite globale de 45 jours évitent de laisser une offre indéfiniment visible.

Les données incomplètes restent privées, avec leurs motifs de non-publication ; elles ne demandent aucune action pour que la rotation continue vers les autres recherches. Les annonces éligibles suivantes se publient seules. Si SerpApi ne fournit ni date explicite ni ancienneté relative exploitable, le résultat peut être **zéro publication**, même avec HTTP 200 : les informations manquantes ne sont jamais remplacées par une date inventée.

Pour une publication relative, `publishedAt` et `sourcePublishedAt` restent **nuls**. `publicationEvidence` contient uniquement le texte original, le type `relative` et l’instant de relevé. La carte et le détail indiquent le texte fourni par Google Jobs et sa date de relevé ; le détail précise que la date exacte n’est pas fournie. La borne basse de l’intervalle sert uniquement à l’index SQL et aux filtres/tri conservateurs, jamais comme date source affichée. Les favoris, détails, compteurs et contrôles de conformité utilisent la même règle. Les nouvelles observations ne rajeunissent pas une ancienneté déjà enregistrée ; une information source devenue trop ancienne suspend la visibilité automatique.

Au premier lancement de cette correction, les résultats privés déjà reçus sont réanalysés à partir de leur **instant d’observation original**, sans nouvel appel SerpApi. Une récupération antérieure trop ancienne n’obtient pas une nouvelle date de collecte. Cette réanalyse utilise au besoin l’API géographique et publie uniquement les fiches admissibles. Le marqueur persistant `serpapi-relative-label-reanalysis-v1` évite de répéter l’opération ; le suivi privé expose ses compteurs. Les exclusions distinguent désormais l’absence d’entreprise, de description ou de lien, les écoles et les contrats hors périmètre.

## Interface et exploitation

Administration → Sources & collecte présente le nombre de recherches effectuées, les domaines parcourus, le budget utilisé, les publications admissibles, les exclusions et les motifs. Il n’y a plus de bouton d’import Google Jobs ni de bouton « Lancer une collecte ». L’historique `serpapi-automatic` conserve les compteurs et erreurs sans clé ni URL complète de requête. `GET /api/admin/serpapi/automation` est protégé par l’accès privé habituel.

Les autres connecteurs LBA/France Travail continuent leur planification existante. Aucune clé n’est déplacée vers le navigateur. L’intégration s’appuie sur l’accès API du propriétaire ; elle ne certifie pas les droits commerciaux de redistribution des fournisseurs et sources originales. Conserver leurs conditions d’utilisation : https://serpapi.com/google-jobs-api et https://serpapi.com/pricing.

Les anciennes annonces Meteojob sont retirées au démarrage, y compris celles approuvées ou en attente ; leur historique reste privé. L’exclusion s’applique aussi à LBA, France Travail, aux flux génériques, aux favoris affichés et aux liens repérés. L’instantané versionné ne contient plus ses sept anciennes annonces.

## Code et vérification

- `shared/serpapi-searches.js` : couverture des domaines.
- `server/ingestion/serpapi-automation.js` : rotation, budget, reprise et suivi.
- `server/ingestion/serpapi-analysis.js` : classification et normalisation.
- `server/ingestion/french-location.js` : communes françaises, correspondance et cache.
- `server/ingestion/serpapi-inbox.js` : dédoublonnage et publication sans intervention.
- `src/SerpApiAutomationStatus.jsx` : suivi privé sans commande d’import.

`npm test`, `npm run test:serpapi`, `npm run test:rapidapi`, `npm run test:browser`, `npm run build`. Les tests utilisent des offres explicitement fictives dans des bases temporaires et des réponses API simulées ; ils ne consomment aucun quota et n’ajoutent rien sur Render. La clé et la base de production ne sont pas accessibles depuis le workspace : la réussite de la collecte réelle doit être constatée dans les journaux du serveur après déploiement.
