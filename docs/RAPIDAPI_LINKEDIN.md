# RapidAPI LinkedIn : test privé sans terminal

L’hôte et le point d’accès sont ceux fournis dans la capture du propriétaire : `GET https://fresh-linkedin-job-search-data.p.rapidapi.com/job-search`. Les paramètres documentés dans cette capture incluent `search`, `location`, `sortBy` et `page`. Aucun format de réponse métier n’a encore été obtenu ni supposé.

## Utilisation

1. Dans Render, enregistrer la nouvelle clé privée sous `RAPIDAPI_LINKEDIN_KEY`, sans préfixe `VITE_` et sans clé dans le code. Une clé exposée précédemment doit être remplacée dans RapidAPI.
2. Déployer le dernier commit du projet.
3. Ouvrir `/administration/`, se connecter, puis la section Sources et collecte autorisée.
4. Dans **RapidAPI · LinkedIn**, cliquer **Tester RapidAPI**. Aucun Shell ni commande à coller n’est nécessaire.

Un seul appel de recherche est réalisé par clic avec `search=alternance informatique`, `location=France`, `sortBy=date`, `page=1`. Le quota et la facturation de la formule RapidAPI choisie s’appliquent. Aucun test automatique au démarrage ou lors du chargement de la page. Le test est limité à un appel par minute et trois appels par heure et par processus serveur ; les compteurs sont réinitialisés au redémarrage et ne sont pas une limite distribuée entre instances.

## Résultat et confidentialité

Le test montre le statut HTTP et un message prédéfini : clé manquante/refusée, abonnement à vérifier, quota atteint, réponse inexploitable ou réseau indisponible. En cas de JSON valide, seul son schéma (noms de champs, types et taille du premier tableau) est montré dans « Afficher la structure ». Les valeurs texte, descriptions, noms de personnes, emails, numéros et jetons ne sont pas repris. Les champs de contacts et d’authentification sont omis. La structure est bornée en profondeur et nombre de champs.

Le dernier diagnostic est conservé dans l’historique privé des sources sous `rapidapi-linkedin-test`. Les routes `/api/admin/rapidapi-linkedin` et `/api/admin/rapidapi-linkedin/test` exigent le même accès privé que la modération. Le navigateur reçoit uniquement ce diagnostic, jamais la clé API. La requête sortante utilise les en-têtes RapidAPI connus, une URL fixe, aucun suivi de redirection, un délai de 30 secondes et une réponse JSON limitée à 2 Mo. Aucun accès direct à LinkedIn ni scraping de ses pages.

## État de l’intégration

Ce test ne crée, ne modifie et ne publie aucune offre. Une réponse HTTP 200 ne prouve pas une autorisation de republication. Après obtention de la structure et des conditions du fournisseur, l’adaptateur devra vérifier les vraies dates, contrats, entreprises, lieux, liens et descriptions, puis appliquer les critères du site et la modération adaptée. Aucun champ absent ne sera inventé. Les droits permettant de republier les données LinkedIn via ce fournisseur restent à confirmer ; une clé RapidAPI seule ne les établit pas.

Tests : `npm test` couvre le transport fixe, les en-têtes privés, l’absence de valeurs/contacts dans le schéma, le quota, les erreurs, l’authentification des routes et l’absence d’offre créée. Ces tests utilisent uniquement des réponses fictives et une base temporaire ; aucun appel RapidAPI réel n’est effectué dans le workspace.
