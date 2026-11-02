# Provenance et réutilisation des données

Le code du projet n’accorde pas de licence supplémentaire sur les annonces ni sur les marques des entreprises. Conserver les conditions des fournisseurs et le lien de chaque source originale ; ne pas revendre des données dont les conditions l’interdisent.

## La Bonne Alternance

L’archive suspendue `market-offers.json` conserve 105 offres uniques reçues le 30 octobre 2026, après exclusion de Meteojob, des données de recette/sandbox et des données insuffisantes, puis dédoublonnage. Les relais France Travail distribués par LBA conservent leur origine et leurs liens. Les actualisations utilisent le connecteur autorisé avec `LBA_API_KEY`. Source et conditions : https://api.apprentissage.beta.gouv.fr/fr/explorer/recherche-offre et https://api.apprentissage.beta.gouv.fr/fr/cgu . L’usage annoncé est gratuit et réservé aux usages non lucratifs ; la présence d’une clé ou du code ne vaut pas accord commercial.

Les dates originales, la collecte et la candidature restent distinctes. Les données sandbox, annonces d’écoles détectées, candidatures spontanées, informations périmées et contacts personnels sont exclus. La récupération API ne certifie pas la disponibilité actuelle. La règle de 30 jours, les échéances source et les retraits s’appliquent à toutes les rubriques.

## Annonces employeurs déjà sourcées

Les fichiers de références contiennent 30 annonces et leurs synthèses éditoriales existantes, avec URL et consultation d’origine. Elles ne constituent ni une nouvelle collecte ni une vérification actuelle. Au démarrage, les références peuvent être préparées en base, sans déplacer les dates originales ni inventer de coordonnées ; seules les annonces admissibles des 30 derniers jours sont affichées, hors clôtures connues. Les cartes le précisent. Le nombre publié baisse avec les échéances, l’ancienneté et les décisions de retrait. Voir [la maintenance tous secteurs](../docs/ALL_SECTORS.md).

## Référentiel de métiers et autres connecteurs

`france-travail-rome.json` contient les 1 584 codes, parents et libellés du référentiel ROME v4.60. La provenance est le CSV du dépôt officiel La Bonne Alternance, fixé au commit cité dans le fichier. Ce sont des métadonnées de classement, pas des annonces supplémentaires.

France Travail est un connecteur distinct, conditionné à ses habilitations : [configuration et conditions](../docs/FRANCE_TRAVAIL.md). Google Jobs via SerpApi dispose de son propre accès fournisseur et de quotas : [fonctionnement et limites](../docs/SERPAPI.md). RapidAPI reste un test privé sans import automatique. Aucun de ces accès ne constitue à lui seul une autorisation commerciale de redistribution des sources originales.

## Fichiers SNCF fournis

Un stage daté est repris avec une synthèse originale limitée au titre et aux métadonnées présentes, sans reproduire une description absente. Les 20 alternances du fichier MHTML sont publiées après confirmation explicite du responsable, sans inventer leurs dates de publication ni reproduire une description détaillée absente. Les documents complets et leurs ressources ne sont pas déployés ; voir [la provenance détaillée](../docs/SNCF_UPLOAD.md).

## Fichier TotalEnergies fourni

Vingt stages datés et leurs liens officiels sont repris avec des synthèses
originales des seules informations de la liste. Le document complet et ses scripts
ne sont pas déployés. L’URL du logo fournie par le portail est référencée pour les
entités TotalEnergies sans revendiquer de partenariat. Voir [la provenance et les
limites de vérification](../docs/TOTALENERGIES_UPLOAD.md).

## Fichier Airbus fourni

Vingt stages et leurs liens Workday originaux sont repris avec des synthèses
limitées aux informations présentes. L’indication « Posted Today » reste relative,
avec une première observation du fichier distincte de la publication. Le document
complet, ses scripts et ses données de session ne sont pas déployés. Le logo local
provient du SVG Airbus de Simple Icons, collection distribuée sous CC0 ; la marque
reste propriété de son titulaire, sans partenariat revendiqué. Voir [la provenance
et les limites](../docs/AIRBUS_UPLOAD.md).

## Fichiers Orange fournis

Les résumés et métadonnées des onze postes admissibles proviennent des documents
fournis ; aucun script, suivi, cookie ou document intégral n’est déployé.
Le logo est issu du dépôt officiel Orange Open Source, conservé comme marque
d’identification du recruteur ou du groupe sans partenariat revendiqué.
Voir [la provenance et la distinction des dates](../docs/ORANGE_UPLOAD.md).
