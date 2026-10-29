# Contrôle de conformité du catalogue

Les règles du propriétaire : stages, apprentissages et contrats de professionnalisation techniques/informatiques (chimie comprise), en France, publiés depuis 45 jours maximum ; sources originales accessibles par une URL HTTPS publique ; aucune école/université ou annonce de formation présentée comme offre d’entreprise ; aucune fausse vérification.

## Contrôles

- `shared/employer-policy.js` identifie un employeur de formation à partir de son nom, secteur ou code NAF 85, sans examiner les mentions d’une école dans la description d’une vraie entreprise. Les accents sont normalisés. Les agences de recrutement ne sont pas exclues en tant que telles.
- Les connecteurs LBA et France Travail et la validation des dépôts refusent ces employeurs. LBA écarte aussi les annonces déléguées à des écoles, les sources de test, les employeurs sans annonce réelle et les offres inactives.
- `nonComplianceReasons` vérifie les données structurées : domaine, contrat, région française, entreprise, source, publication et échéances. Les données manquantes ne sont pas devinées.
- `OfferStore.auditPublicOffers()` parcourt les offres approuvées au démarrage et après la collecte. Les offres hors critères sont retirées publiquement ; les annonces dont seules les dates ne conviennent plus passent à l’état expiré. L’historique reste privé et récupérable. Aucune suppression physique de la base.
- Les index, listes, compteurs et détails suivent les statuts corrigés. `publicOffer` constitue une protection supplémentaire. Les favoris locaux cachent également les écoles identifiées et les contrats hors périmètre.

Un retrait de conformité reste retiré lors des collectes suivantes. L’expiration locale est distincte : une offre qui était seulement arrivée à son échéance peut être renouvelée à partir d’une nouvelle réponse source valide. Les dates de publication originales ne sont jamais remises à zéro.

## Résultats visibles par le responsable

Le log serveur `[Catalogue] Contrôle de conformité` fournit le nombre de lignes contrôlées, retirées et expirées au démarrage. Quand des changements sont faits, une exécution `catalogue-audit` avec motifs et identifiants internes est inscrite dans l’historique privé des sources. Aucun contact personnel ni secret n’est ajouté au rapport.

Ces contrôles n’affirment pas que toutes les annonces sont encore ouvertes en temps réel ni que tous les employeurs ont été vérifiés manuellement. Les descriptions ambiguës nécessitent toujours une revue du responsable. Un organisme non identifié dans les données source ne peut pas être reconnu avec certitude.

## Catalogue embarqué

Lors du contrôle du 29 octobre 2026, quatre annonces ont été retirées de `config/market-offers.json` : trois publications dépassant 45 jours (FAYAT ENERGIE SERVICES, DISLAUB, SYNERGIE) et une annonce de Sorbonne Université. Sept lignes étaient encore éligibles dans cet instantané à cette date. Les dates originales de collecte et publication des lignes conservées ne sont pas modifiées. Ces chiffres concernent uniquement le fichier embarqué, pas la collecte récente ni la base de Render.

Le déploiement de cette version exécute l’audit sur la base configurée dans Render. Sans accès à cette base et à son compte rendu, aucune suppression en production ni aucun nombre d’offres récentes ne peut être confirmé depuis le workspace.

## Tests

`npm test` couvre les noms accentués d’écoles/universités, les employeurs légitimes et agences, les contrôles des deux connecteurs, le retrait d’anciennes lignes à l’ouverture d’une base, les compteurs, l’idempotence, les dates malformées, la persistance des retraits et l’absence de date de vérification inventée. Les tests utilisent exclusivement des données fictives dans des bases temporaires.
