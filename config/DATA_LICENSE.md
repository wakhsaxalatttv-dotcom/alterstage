# Provenance et réutilisation des données

Le code du projet n’accorde pas de licence supplémentaire sur les annonces ni sur les marques des entreprises. Conserver les conditions des fournisseurs et le lien de chaque source originale ; ne pas revendre des données dont les conditions l’interdisent.

## La Bonne Alternance

L’instantané `market-offers.json` contient 105 offres uniques reçues le 30 octobre 2026, après exclusion de Meteojob, des données de recette/sandbox et des données insuffisantes, puis dédoublonnage. Les relais France Travail distribués par LBA conservent leur origine et leurs liens. Les actualisations utilisent le connecteur autorisé avec `LBA_API_KEY`. Source et conditions : https://api.apprentissage.beta.gouv.fr/fr/explorer/recherche-offre et https://api.apprentissage.beta.gouv.fr/fr/cgu . L’usage annoncé est gratuit et réservé aux usages non lucratifs ; la présence d’une clé ou du code ne vaut pas accord commercial.

Les dates originales, la collecte et la candidature restent distinctes. Les données sandbox, annonces d’écoles détectées, candidatures spontanées, informations périmées et contacts personnels sont exclus. La récupération API ne certifie pas la disponibilité actuelle. La règle de 45 jours, les échéances source et les retraits s’appliquent à toutes les rubriques.

## Annonces employeurs déjà sourcées

Les fichiers de références contiennent 30 annonces et leurs synthèses éditoriales existantes, avec URL et consultation d’origine. Elles ne constituent ni une nouvelle collecte ni une vérification actuelle. Au démarrage, seules les références encore admissibles rejoignent Offres, sans déplacer les dates originales ni inventer de coordonnées. Les cartes le précisent. Le nombre publié baisse avec les échéances, l’ancienneté et les décisions de retrait. Voir [la maintenance tous secteurs](../docs/ALL_SECTORS.md).

## Référentiel de métiers et autres connecteurs

`france-travail-rome.json` contient les 1 584 codes, parents et libellés du référentiel ROME v4.60. La provenance est le CSV du dépôt officiel La Bonne Alternance, fixé au commit cité dans le fichier. Ce sont des métadonnées de classement, pas des annonces supplémentaires.

France Travail est un connecteur distinct, conditionné à ses habilitations : [configuration et conditions](../docs/FRANCE_TRAVAIL.md). Google Jobs via SerpApi dispose de son propre accès fournisseur et de quotas : [fonctionnement et limites](../docs/SERPAPI.md). RapidAPI reste un test privé sans import automatique. Aucun de ces accès ne constitue à lui seul une autorisation commerciale de redistribution des sources originales.
