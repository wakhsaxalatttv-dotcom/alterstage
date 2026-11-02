# Stages et alternances : tous secteurs, disponibilité contrôlée

La plateforme couvre 42 domaines, les 1 584 métiers ROME des familles A à N,
les stages, l’apprentissage, la professionnalisation et l’alternance sans
sous-type précisé. Les PME, TPE, ESN, associations et grands groupes sont admis
sans inventer la taille d’une entreprise. Meteojob, annonces d’écoles détectées,
contrats ordinaires et sources de développement/préproduction restent exclus.

## Condition de publication depuis le 2 novembre 2026

Une date de publication de moins de 45 jours, une autorisation de réutilisation
et un statut fournisseur « Active » sont nécessaires lorsque applicables, mais
ne suffisent jamais à établir la disponibilité. Il faut également une preuve
positive de candidature ouverte, liée à l’URL actuelle et datant de moins de
24 heures :

- contrôle de la page individuelle : données `JobPosting` correspondant au titre
  et à l’employeur, échéance `validThrough` future, contrôle de candidature activé,
  absence de message explicite de clôture ;
- ou revue humaine privée, avec attestation explicite que l’annonce originale a
  été ouverte et que les candidatures sont toujours possibles.

Les requêtes SQL, compteurs, détails, fiches entreprises, Repérées et favoris
appliquent ce contrôle. Une collecte ne fabrique pas cette preuve. Un résultat
inconcluant reste masqué sans affirmer qu’il est clôturé. Les 404/410 et messages
explicites de clôture déclenchent un retrait durable. Une réponse HTTP 200 seule
ne suffit pas. Le badge humain reste distinct du contrôle automatique.

## Collecte et contrôle

Google Jobs conserve ses 94 recherches universelles, PME/TPE/start-up/association
et sectorielles, avec quotas persistants (3/heure et 24/jour par défaut). France
Travail parcourt les métiers avec curseur de reprise et budget borné. LBA peut
recevoir les relais FT, sans prétendre qu’un accès OAuth direct est actif.

Les vérifications de candidature sont limitées à trois connexions simultanées,
200 offres par passage, toutes les 15 minutes et après collecte, sans répéter une
page avant six heures. Elles valident les destinations et redirections publiques,
limitent la réponse et n’envoient aucune clé API aux pages de candidature.

`npm run maintain:offers` exécute collecte, conformité et contrôle de disponibilité.
Le bilan privé est conservé dans `.local/maintenance-last.json` (ou `DATA_DIR`), sans
clé ni corps de réponse. Il indique explicitement qu’il s’agit de l’environnement
local. Les clés et le déploiement Render restent des états séparés.

## Archives et déploiement

Le lot de 105 annonces du 30 octobre signalé comme pourvu reste suspendu dans
`config/market-offers.json`. Ce fichier conserve sa provenance et sa liste de
blocage ; il n’est plus une base à publier. Les références éditoriales historiques
peuvent être préparées en base, mais aucune n’est affichée sans preuve actuelle.
Une ancienne consultation n’est jamais datée du jour du déploiement.

`npm run export:market` écrit uniquement les offres LBA publiques avec preuve
positive dans `config/verified-market-offers.json`, sans écraser l’archive suspendue.
Sans offre admissible, il refuse de générer un instantané. Au démarrage, seules les
preuves encore valides peuvent rendre un instantané récent visible ; elles ne
sont jamais rajeunies. Le site peut donc démarrer avec zéro offre : aucun remplissage
par des postes pourvus ou fictifs n’est autorisé.

Les noms techniques des connecteurs restent privés dans les cartes/fiches ;
le lien original de candidature et la provenance interne sont conservés.
Voir le [bilan réel de l’audit du 2 novembre](OFFERS_AUDIT_2026-11-02.md).
