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

## Sélection éditoriale « Repérées »

Dix références supplémentaires ont été consultées le 27 octobre 2026 sur **VINCI Jobs**, portail officiel du groupe. Elles concernent neuf entreprises ou entités (toutes rattachées au groupe VINCI) : Axians CC Lille, Omexom Conversion & Storage, VINCI Energies Systèmes d’Information (deux stages distincts), ETF, Enfrasys, Axians Services Infras Océan Indien, Sysoco UF, Cegelec Réunion Ascenseurs et VINCI Facilities IMD. Elles complètent les six références Safran dans l’onglet Repérées ; elles ne sont pas importées dans le catalogue API.

Les liens exacts, dates, profils et synthèses originales figurent dans `shared/employer-references.js`. Chaque page présentait une description et un bouton de candidature lors de la consultation. Cela ne garantit pas que le recrutement est toujours ouvert : `status=to_verify` et `lastVerifiedAt=null` sont conservés. Aucune reproduction intégrale ni collecte automatique périodique des pages n’est activée ; les candidatures passent par les liens officiels.

Plusieurs pages VINCI présentent une date `datePosted` structurée plus récente que la date affichée sous le titre. Nous conservons **la date visible plus ancienne** comme publication, y compris les dates de septembre 2026. La métadonnée distincte est conservée et expliquée dans la fiche ; elle ne rafraîchit pas l’offre et ne constitue pas une vérification. Les références anciennes portent l’avertissement de disponibilité à confirmer. Une annonce Actemium dont la date visible était le 18 septembre 2019 a été écartée, ainsi qu’une piste Citeos datée du 5 mai 2026.

Les détails techniques, formations, durées et dates de début viennent des fiches consultées. Les informations absentes restent non précisées. Les démarches ISO citées chez Cegelec ne sont pas présentées comme des certifications acquises. Aucun contact personnel, logo ni description complète n’a été collecté pour publication.
