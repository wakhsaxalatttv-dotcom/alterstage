# Actualisation des offres du 18 novembre 2026

Collecte ponctuelle, sans déclaration d'exhaustivité du marché français.
Les sources réellement accessibles ont été exploitées ; les réponses bloquées,
les simples résultats de recherche et les statuts actifs d'un agrégateur ne
constituent pas des preuves de candidature ouverte.

## Résultats

- VINCI : plan de site public, 513 fiches contenant des termes de stage ou
  d'alternance contrôlées ; 290 fiches retenues après contrôle de date initiale,
  type de contrat, employeur, localisation française et entrée de candidature.
- EDF : 124 fiches contrôlées à partir des 46 liens déjà connus puis des liens
  de postes liés sur les fiches employeur ; 78 fiches retenues, 19 réponses 404.
- Total du lot : 368 fiches, soit 349 stages et 19 alternances, couvrant
  16 domaines et 130 entités employeuses. Les départements français d'outre-mer
  sont inclus quand la localisation est explicite. Les métadonnées manquantes
  restent absentes : aucune commune ou région n'est inventée.
- Base locale avant intervention : 325 offres publiques. Après import :
  338 créations, 30 mises à jour, 19 retraits pour HTTP 404, soit 644 offres.
  Les annonces dont la date initiale dépasse 30 jours restent exclues, même
  si le portail les remet en avant avec une date plus récente.

Les autres pistes ont également été contrôlées : Thales donne huit fiches
françaises récentes dans sa recherche, mais les pages de ces huit postes disent
qu'ils sont pourvus ; elles ne sont pas importées. Les identifiants courts et
les adresses canoniques ont été contre-vérifiés pour le premier poste. Safran
refuse la lecture automatisée (HTTP 403). Google renvoie sa page nécessitant
JavaScript, sans résultats exploitables. La clé locale La Bonne Alternance
permet une lecture ; 14 candidats récents subsistent après les exclusions,
mais les candidatures et certaines localisations ne sont pas établies. Aucune
de ces 14 fiches n'est publiée. Les identifiants France Travail et SerpApi sont
absents de cet environnement ; leur état sur Render n'est pas déduit.

## Preuves conservées et limites

Le lot est stocké dans config/collected-employers.json, côté serveur uniquement.
Chaque fiche conserve le lien, la référence, l'employeur, les dates et l'empreinte
SHA-256 de la page, l'heure réelle du contrôle, l'identité du poste et la présence
d'une entrée de candidature associée au poste. La vérification ne repose donc
pas sur HTTP 200 seul. Aucune candidature, connexion ATS ou prise de contact n'a
été effectuée ; l'aboutissement de la candidature et sa disponibilité future ne
sont pas garantis. lastVerifiedAt et le badge de contrôle humain restent absents.

Les résumés nouveaux sont des présentations factuelles originales : poste,
entité, localisation, catégorie et sujets/technologies explicitement cités.
Les descriptions complètes restent consultables sur les fiches d'origine.
Les originaux HTML et leurs scripts ne sont ni exécutés ni embarqués dans le
site. Les URL de candidature ne contiennent pas de clé API ou contact personnel.
Les règles robots des chemins de fiches employeur ont été consultées.

Le chargeur seedCollectedEmployers réutilise la normalisation, le dédoublonnage
et les règles du catalogue. Il refuse une observation future, ancienne, sans
identité ou contrôle de candidature, hors des sources autorisées ou relayée
par Meteojob. Les dates et heures observées ne sont pas renouvelées au démarrage.
Une date de première publication déjà connue reste prioritaire sur une nouvelle
date affichée. Les retraits et rejets humains sont conservés. Les réponses 404
ou 410 documentées retirent uniquement les fiches correspondantes, avec motif et
date, sans effacer l'historique. Une erreur réseau n'est jamais une clôture.

Les limites françaises restent appliquées. Pour les DOM ou les localisations
sans région reconnue, le libellé technique reste « France » et le libellé
employeur complet est conservé dans le résumé et la provenance. Aucune région
métropolitaine n'est attribuée arbitrairement à une offre d'outre-mer.

## Validation et déploiement

135 tests réussis, compilation de production réussie. Les tests des imports
historiques Orange, Sephora, SNCF, Thales et TotalEnergies sont désormais fixés
à leur date réelle d'import du 3 novembre : leurs attentes ne dépendront plus
du jour d'exécution. Les contrôles de péremption en production restent inchangés.
La nouvelle collecte est testée à la date courante, avec essais de retrait,
d'absence de preuve, de fausse identité, d'expiration et de non-rajeunissement.

Le lot de près de 1 Mo n'est pas inclus dans le JavaScript public : il est lu au
démarrage serveur et les résultats restent paginés via les API existantes.
Le navigateur local a vérifié la liste, les filtres, la pagination, les fiches,
les liens et l'affichage mobile/ordinateur. Les 368 routes de détail répondent
avec la bonne provenance ; aucune erreur JavaScript n'est apparue.

Les nombres ci-dessus décrivent la base locale. Aucun déploiement Render ni
rafraîchissement de sa base distante n'est prétendu. Après envoi GitHub, déployer
la dernière révision du service ; les traces [Collecte employeurs] indiquent le
résultat réellement obtenu sur ce serveur. Les changements n'ajoutent pas de
nouvelle clé et ne modifient pas le design ni les décisions de modération.
