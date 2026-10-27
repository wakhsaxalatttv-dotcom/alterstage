# État des sources — 27 octobre 2026

## Source configurée et import réalisé

La clé `LBA_API_KEY` fournie dans les paramètres sécurisés fonctionne : l’API officielle de La Bonne Alternance répond HTTP 200 sur `/api/job/v1/search`. Aucune valeur de clé n’a été copiée dans le dépôt ou affichée.

La recherche intégrée sur les codes ROME techniques/informatiques a renvoyé 68 annonces hors France Travail et 150 entreprises à potentiel d’embauche sans annonce. Après contrôles :

- 47 offres d’alternance ont été importées et rendues visibles sans badge de vérification ;
- 2 doublons ont été écartés ;
- 1 annonce dont la source porte explicitement la mention sandbox a été exclue ;
- 15 annonces déléguées à des écoles ou identifiées comme liées à des organismes de formation ont été écartées ;
- 3 fiches incomplètes/non localisables de façon fiable ont été écartées ;
- les 150 entreprises sans annonce déposée n’ont jamais été transformées en offres.

Les 47 offres sont publiées depuis plus de 30 jours. Le responsable a explicitement demandé de les inclure lorsque leur statut API est encore actif et leur date d’expiration source future. Elles sont affichées « Offre ancienne — disponibilité à confirmer », avec leur vraie date. La date de collecte ne devient pas une date de publication ou de vérification. Aucun stage n’a été inventé pour compléter cette source d’alternances.

L’instantané `config/market-offers.json`, sans clé ni contacts personnels, permet de charger les données sur Render au prochain déploiement. La collecte directe en ligne exige la clé originale dans les secrets **du serveur Render**, distincts des secrets de l’environnement Codex. Sans clé sur Render, le site affiche un instantané daté et masque les offres arrivées à expiration ; il ne prétend pas actualiser en direct.

L’API réserve la diffusion aux usages gratuits et non lucratifs. Respecter `config/DATA_LICENSE.md` ; ne pas revendre les données ou facturer leur accès sans nouvel accord. Le lot n’est pas exhaustif : il correspond au périmètre ROME actuel du connecteur. L’export global officiel pointe vers `s3.rbx.io.cloud.ovh.net`, dont le téléchargement n’était pas accessible dans cet environnement.

## Autres sources examinées

- Safran et VINCI : pages accessibles mais conditions exigeant une autorisation écrite de reproduction ; aucune collecte automatisée de leurs sites ni copie de leurs descriptions n’est activée.
- Remote OK : API accessible avec conditions d’attribution ; pas de stage/alternance éligible dans la réponse examinée.
- Remotive : API accessible ; pas de stage/alternance technique français établi dans les résultats examinés.
- The Muse : API examinée en mode test ; résultats techniques français trop anciens ou hors périmètre. Une application enregistrée est requise au-delà des tests. Aucun accès de production ni partenariat n’est prétendu.
- data.gouv.fr : le jeu trouvé sur le baromètre de l’alternance du Rhône contient des statistiques, pas des annonces à transformer en postes.

La présence d’une API ou d’une page publique ne vaut pas à elle seule autorisation de republication. Les offres d’origine France Travail restent exclues conformément au choix du projet.
