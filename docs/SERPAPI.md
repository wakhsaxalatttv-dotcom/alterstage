# SerpApi — Google Jobs

## Configuration et utilisation

1. Dans Render → Environment, définir `SERPAPI_API_KEY` avec la clé personnelle du compte SerpApi.
2. Déployer la version du code contenant ce connecteur.
3. Dans `/administration/` → Sources & collecte → **SerpApi · Google Jobs**, cliquer **Tester SerpApi**.

Le contrôle utilise `GET https://serpapi.com/search.json`, `engine=google_jobs`, `q=alternance informatique`, `location=France`, `gl=fr`, `hl=fr`. Une seule page est demandée, sans pagination ni collecte automatique. Le nombre de résultats est celui de cette page, pas celui des offres éligibles au site ni du marché français entier. Un clic consomme le quota du compte ; limite par instance : un appel par minute, trois par heure. Le démarrage du serveur et la lecture du statut ne consomment pas d’appel.

Routes privées : `GET /api/admin/serpapi`, `POST /api/admin/serpapi/test`. Le résultat est conservé dans l’historique privé : statut HTTP, date, compteurs et structure anonymisée. Aucune valeur d’annonce, clé, URL de requête complète ni coordonnée n’est conservée. La clé est transmise au fournisseur via le paramètre `api_key` requis par son API ; l’application ne journalise pas cette URL et ne suit pas les redirections.

## Limites et prochaine étape

Il s’agit du contrôle de connexion, **pas encore d’un import d’annonces**. Le bouton de collecte général n’importe pas Google Jobs. Le succès d’un test ne certifie ni l’actualité ni l’éligibilité des offres. Les erreurs de clé, d’abonnement, de quota, de format et de réseau sont affichées sans recopier la réponse brute du fournisseur.

Avant l’import et la republication, vérifier les droits de réutilisation du fournisseur et des sources originales, puis mapper la réponse réelle : contrats stage/apprentissage/professionnalisation, domaines techniques/informatiques/chimie, localisation française, dates de publication de moins de 45 jours et lien original de candidature. Les dates relatives Google Jobs ne doivent pas être présentées comme des dates exactes fournies par l’employeur. Aucune collecte exhaustive ni description complète n’est promise. Une offre reçue d’un agrégateur ne devient pas automatiquement une offre vérifiée.

Documentation du fournisseur : https://serpapi.com/google-jobs-api
Tarifs et quotas du compte : https://serpapi.com/pricing
Les prix actuels et droits de republication ne sont pas validés par ce code.

Tests : `node --test test/serpapi.test.js`, `npm test`, `npm run build`. Ils utilisent des réponses fictives en mémoire et ne consomment pas de quota SerpApi.
