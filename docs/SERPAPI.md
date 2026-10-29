# SerpApi — Google Jobs

## Configuration et utilisation

1. Dans Render → Environment, définir `SERPAPI_API_KEY` avec la clé personnelle du compte SerpApi.
2. Déployer la version du code contenant ce connecteur.
3. Dans `/administration/` → Sources & collecte → **SerpApi · Google Jobs**, cliquer **Tester SerpApi** pour le diagnostic, ou utiliser la file privée d’import décrite ci-dessous.

Le contrôle utilise `GET https://serpapi.com/search.json`, `engine=google_jobs`, `q=alternance informatique`, `location=France`, `gl=fr`, `hl=fr`. Une seule page est demandée, sans pagination ni collecte automatique. Le nombre de résultats est celui de cette page, pas celui des offres éligibles au site ni du marché français entier. Un clic consomme le quota du compte ; limite par instance : un appel par minute, trois par heure. Le démarrage du serveur et la lecture du statut ne consomment pas d’appel.

Routes privées : `GET /api/admin/serpapi`, `POST /api/admin/serpapi/test`. Le diagnostic du test seul est conservé dans l’historique privé : statut HTTP, date, compteurs et structure anonymisée. Aucune valeur d’annonce, clé, URL de requête complète ni coordonnée n’est conservée. La clé est transmise au fournisseur via le paramètre `api_key` requis par son API ; l’application ne journalise pas cette URL et ne suit pas les redirections.

## Import privé et validation

Le bouton **Importer Google Jobs** effectue une requête SerpApi pour la recherche sélectionnée : alternance/stage informatique, réseaux et télécoms, systèmes électroniques, maintenance industrielle, chimie/matériaux ou chimie/procédés. Une page seulement, sans pagination ni promesse d’exhaustivité. Test et import partagent le budget d’un appel par minute et trois par heure par instance. Un import initial unique au démarrage est désormais prévu à la demande du propriétaire, comme détaillé ci-dessous. Le planificateur général ne collecte pas Google Jobs.

Avant le clic, le responsable doit attester disposer des droits de conservation et de réutilisation des annonces et descriptions. L’accès technique à SerpApi ne prouve pas ces droits. Le serveur exige cette attestation ; aucun contenu n’est stocké par le test simple.

Les résultats importés sont stockés séparément dans SQLite, table `serpapi_candidates`, jamais dans le catalogue public. Ils conservent uniquement les champs utiles : titre, entreprise, lieu tel que fourni, description nettoyée, lien source/candidature, indication textuelle de publication, dates réelles de récupération. Les contacts et le HTML actif sont retirés ; les logos ne sont pas recopiés sans autorisation.

Le préfiltre exige une mention de stage/alternance/apprentissage dans le titre, exclut les CDI, freelances et écoles identifiées, exige un lien HTTPS hors moteur de recherche et une description. Il ne prétend pas vérifier automatiquement la région, le domaine ou l’identité de l’employeur. Une date ISO explicite ancienne ou future entraîne l’exclusion. Les mentions relatives restent du texte et ne deviennent jamais une date exacte inventée.

Le hash titre/entreprise/lieu/URL empêche les imports répétés ; une fiche déjà écartée ou transmise n’est pas réactivée au clic suivant. La liste affiche au maximum 100 fiches privées récupérées depuis moins de 45 jours. L’ancienneté de récupération n’est pas présentée comme la date de publication.

**Compléter pour validation** ouvre un formulaire prérempli. Le responsable consulte le lien, renseigne le vrai site entreprise, le contrat, le domaine autorisé, la région française et la date de publication source. Une attestation de contrôle de date et une date de 45 jours maximum sont exigées côté serveur. La fin de validité choisie dans le formulaire est un réglage local, pas une date de fermeture fournie par la source. Le dépôt rejoint ensuite **En attente** ; les contrôles habituels de source, droits, entreprise et contacts restent requis pour publier. Une fiche simplement reçue de Google Jobs n’obtient aucun badge vérifié.

Routes privées supplémentaires :

- `POST /api/admin/serpapi/import` : `{rightsConfirmed: true, query}` ; recherches limitées à la liste prévue par le serveur.
- `GET /api/admin/serpapi/candidates` : file privée, aucune route publique.
- `POST /api/admin/serpapi/candidates/:id/submit` : compléments documentés et `sourceDateChecked: true`, création atomique d’une annonce en attente.
- `POST /api/admin/serpapi/candidates/:id/reject` : écarter sans publier.

Le retour HTTP 200 du fournisseur valide seulement la connexion et le format. La collecte complète du marché, la couverture de tous les métiers, les descriptions intégrales et la réutilisation commerciale ne sont pas garanties. Aucune collecte de production n’est exécutée par les tests du dépôt.

Documentation du fournisseur : https://serpapi.com/google-jobs-api
Tarifs et quotas du compte : https://serpapi.com/pricing
Les prix actuels et droits de republication ne sont pas validés par ce code.

Tests : `npm test`, `npm run test:serpapi`, `npm run test:serpapi-import`, `npm run build`. Ils utilisent des réponses fictives en mémoire et ne consomment pas de quota SerpApi.

## Import initial demandé et exclusion Meteojob

Le propriétaire a demandé un import direct avec analyse et exclusion de Meteojob. Au prochain lancement de `server/index.js`, si `SERPAPI_API_KEY` est disponible, **un appel** est effectué pour « alternance informatique » en France. Les résultats éligibles au préfiltre sont analysés (technologies explicitement mentionnées et informations restant à vérifier), dédoublonnés et stockés dans la file privée ; aucune date manquante ni validation n’est fabriquée. Les résultats sans date ou critères confirmés ne sont pas publiés automatiquement.

Un marqueur atomique dans `metadata`, propre à cette demande, empêche les appels répétés au redémarrage et entre processus utilisant la même base. L’échec n’entraîne pas de boucle de nouvelle tentative ; le bouton privé permet de réessayer. Le disque SQLite doit être persistant : si toute la base est supprimée, le marqueur disparaît aussi. `SERPAPI_STARTUP_IMPORT=false` désactive cet import initial. Les tests ne le lancent qu’avec des réponses simulées ; le test de connexion manuel reste disponible. Le journal privé `serpapi-import-startup` donne les compteurs réels du serveur, sans clé ni URL contenant la clé.

La politique partagée `shared/source-policy.js` bloque Meteojob par nom de fournisseur, domaine du lien original ou de candidature, champ `via` et options de candidature Google Jobs. Une annonce portant une provenance Meteojob est exclue même si un autre lien non Meteojob existe. Une simple mention dans le texte d’un employeur ne déclenche pas l’exclusion.

Au démarrage, les anciennes annonces Meteojob approuvées, en attente ou expirées sont retirées ; leur historique reste privé. Les anciennes fiches Google Jobs concernées sont écartées. La règle s’applique aussi aux nouveaux dépôts, à LBA/France Travail/flux génériques, à la validation manuelle, aux liens repérés et aux favoris locaux affichés. Les sept annonces Meteojob de l’instantané versionné ont été supprimées ; aucune annonce de remplacement n’a été inventée. Le compteur des offres publiques peut donc baisser ou devenir nul jusqu’à réception d’offres éligibles d’autres sources.

La clé Render et la base de production ne sont pas accessibles depuis le workspace : l’import et le retrait de production prennent effet lors du déploiement, et doivent être confirmés par les journaux Render. Un test local ne constitue pas une confirmation de collecte sur le site déployé.
