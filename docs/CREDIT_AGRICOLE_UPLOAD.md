# Analyse des quatre fichiers Crédit Agricole du 3 novembre 2026

Les quatre fichiers contiennent 33 cartes chacun, soit 132 cartes et 131 références
distinctes (un doublon entre les pages). Les titres, entités employeuses, contrats,
villes, régions, catégories et logos proviennent directement des cartes.

122 fiches sont situées en France. Neuf autres sont exclues du périmètre :
sept au Luxembourg, une à Monaco et une en Italie. Les liens sont conservés
avec la raison d'exclusion dans le manifeste.

Toutes les dates sont explicitement « Mis à jour le », du 30 octobre au 3 novembre.
Elles sont stockées dans sourceUpdatedAt et jamais comme publishedAt. Aucune
date de première publication, mission détaillée, durée, rémunération ou diplôme
absents des documents n'est inventé. Les logos sont les URL d'origine, propres
à chaque entité ; aucun logo de filiale n'est remplacé par celui d'une autre.

Le contrôle d'une fiche officielle est bloqué par le proxy CONNECT HTTP 403.
Lors de l’analyse initiale, une date de publication admissible ou une
confirmation explicite du responsable restait nécessaire pour ce lot. Les exceptions SNCF, Toyota
et RTE ne s'appliquent pas implicitement à Crédit Agricole. Les 122 annonces étaient initialement en attente, sans modification du catalogue.

Les fichiers HTML et leurs scripts, traceurs et données de session ne sont pas
livrés. config/credit-agricole-pending.json conserve uniquement les faits utiles,
les liens et les empreintes des fichiers. Le chargement au démarrage est
autorisé uniquement par la confirmation explicite décrite ci-dessous.

## Publication confirmée par le responsable

Le responsable a explicitement confirmé avoir vérifié l’ouverture des
candidatures et demandé l’ajout des fiches françaises. Les 120 stages et
2 alternances sont donc publiés via une exception limitée à ces 122 références,
leurs liens et leurs empreintes de document. La confirmation du 3 novembre
2026 est fixe et expire après 30 jours, sans renouvellement au redémarrage.
Les dates de publication restent nulles ; seules les mises à jour sources
sont conservées. Aucun badge de contrôle automatique ou description détaillée
absente du fichier n’est inventé. Les clôtures et retraits restent prioritaires.

Des références distinctes partagent parfois exactement le même titre, employeur
et ville. Leur référence est alors ajoutée au titre affiché pour éviter leur
fusion, sans inventer de différence dans les missions. Le titre original est
conservé dans la provenance. Les sept entités employeuses gardent leur nom et
leur logo d’origine ; les images distantes restent tributaires du réseau.

Validation locale : 128 tests réussis, compilation de production réussie,
122 fiches contrôlées via API ; pagination de 50 annonces sur trois pages,
fiche détaillée, lien employeur, absence de faux badge et absence de débordement
sur téléphone (390 px) et ordinateur (1440 px). Aucun succès du déploiement
Render ni du chargement des logos distants n’est supposé.
