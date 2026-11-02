# Audit réel du 2 novembre 2026

## Résultat

**Aucune nouvelle annonce publiée : zéro candidature ouverte confirmée.**
Ce constat décrit uniquement les sources et pages accessibles dans ce workspace,
pas l’absence d’offres sur le marché français. Le déploiement Render n’a pas été
inspecté ni modifié : ses requêtes sont bloquées par le proxy réseau.

## Recherches réalisées

- 35 requêtes API authentifiées réussies : une recherche globale, puis un métier
  ROME représentatif pour chacun des 34 domaines mappés par ce référentiel dans
  l’application. Il s’agit de contrôles ciblés, pas d’une recherche exhaustive de
  chaque métier. Les 42 domaines du site restent disponibles dans les filtres et
  les recherches Google Jobs prévues.
- La réponse globale contenait 324 annonces : 210 au-delà de 45 jours,
  57 Meteojob exclues et 57 annonces de test/développement ou de préproduction.
  Les trois annonces encore récentes avant durcissement du contrôle de provenance
  pointaient toutes vers un sous-domaine de développement. Aucune n’a été publiée.
- Les 150 entrées de recruteurs/candidatures spontanées ne sont pas des offres et
  n’ont pas été transformées en annonces.
- Les contrôles sectoriels n’ont donné aucun candidat admissible supplémentaire.
  Les résultats de requêtes différentes se recouvrent : ne pas les additionner
  pour annoncer un nombre d’offres uniques.
- Sept accès complémentaires ont été tentés : site Render, sites/API employeurs
  SmartRecruiters, Greenhouse, Lever, Welcome to the Jungle et France Travail.
  Tous ont été refusés par le proxy (CONNECT HTTP 403). Aucune fermeture ou
  ouverture d’annonce n’en est déduite.

Le [journal sans secret des recherches](audits/2026-11-02-searches.json) conserve
les horaires UTC, métiers représentatifs, volumes et motifs d’exclusion ; aucune
clé, réponse brute ou coordonnée personnelle n’est incluse.

## Maintenance locale

`npm run maintain:offers` a été exécuté avec la configuration locale disponible.
La clé LBA était disponible ; les clés SerpApi et OAuth France Travail ne l’étaient
pas dans ce workspace. Cela ne dit rien de leur présence sur Render.

Le contrôle de conformité a expiré trois annonces historiques. Les 26 annonces
restantes ont été soumises au contrôle de candidature : zéro ouverture confirmée,
zéro clôture prouvée, 26 résultats inconcluants. Avec la nouvelle règle, les 26
restent masquées ; leur historique est conservé. Le lot suspendu de 105 annonces
reste bloqué et ne peut être ressuscité par un nouvel import.

## Vérification du code

Les tests unitaires/intégration couvrent notamment : refus d’un simple statut
« Active », preuve positive avec titre/employeur correspondants et candidature,
échéance future, durée maximale de 24 heures, preuve liée à l’URL, clôtures,
réponses inconcluantes, modération, filtres/compteurs, Repérées et favoris.
Les scénarios navigateur utilisent uniquement des preuves simulées dans des
bases isolées ; ils ne prouvent la disponibilité d’aucune annonce réelle.

Le nouveau contrôle automatique fonctionne lorsque l’annonce expose des données
JobPosting suffisamment complètes et une action de candidature. Une page basée
sur JavaScript, sans échéance structurée ou inaccessible reste masquée jusqu’à
une vérification humaine explicite depuis l’administration. Aucune date manquante
n’est inventée pour améliorer les volumes.
