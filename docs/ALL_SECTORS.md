# Stages et alternances : tous secteurs, publication de moins de 30 jours

## Règle actuelle, demandée le 2 novembre 2026

Les annonces admissibles publiées dans les **30 derniers jours** sont affichées
dans Offres et Repérées. Le blocage obligatoire par preuve de disponibilité de
moins de 24 heures a été supprimé à la demande du responsable : un contrôle réseau
inconcluant ne retire plus une annonce récente et n’est pas assimilé à une clôture.

La date originale fait foi : une nouvelle collecte ne rajeunit pas une annonce.
Les 404/410, clôtures explicitement constatées, échéances source dépassées, retraits
ou refus de modération restent exclus. Aucune nouvelle vérification ni badge humain
n’est inventé au rétablissement. Les sources Meteojob, écoles détectées et données
de test/développement restent interdites.

L’application couvre 42 domaines, les stages, l’apprentissage, la
professionnalisation et l’alternance sans sous-type précisé. Les PME, TPE, ESN,
associations et grands groupes sont admis, sans taille d’entreprise inventée.
Les diagnostics Google Jobs démarrent également sur une recherche générale « stage » ; le diagnostic LinkedIn sur « alternance ». Le sélecteur privé propose tous les secteurs, sans restriction aux sept anciennes recherches techniques. Le formulaire accepte des compétences et outils de tout métier.

Le même seuil de 30 jours est appliqué aux requêtes, compteurs, détails, filtres,
Repérées, favoris et connecteurs. Les indices relatifs de publication restent des
intervalles conservateurs, jamais des dates exactes inventées.

## Rétablissement et vérification

Le 2 novembre, 24 annonces employeurs sourcées respectent la nouvelle limite dans
la base locale et sur une base neuve préparée pour déploiement. Elles sont rétablies
avec leurs dates et consultations originales. Les anciennes consultations ne sont
plus utilisées comme échéances artificielles de huit jours ; une véritable date
de fermeture transmise par la source reste appliquée.

Le lot contesté de 105 annonces du 30 octobre reste en archive suspendue. Ses dates
sont toutes antérieures à la nouvelle limite ; il ne participe donc pas au
rétablissement. Une décision de retrait individuel ne peut pas être annulée par
une nouvelle collecte ou un redémarrage.

La publication récente n’est pas une promesse que le poste est encore libre. Les
contrôles de candidature continuent en arrière-plan (trois connexions simultanées,
200 annonces par passage, toutes les 15 minutes et après collecte, nouvelle lecture
après six heures). Les résultats positifs, clôtures et échecs réseau restent
séparés. Seule une clôture ou expiration établie entraîne un retrait à ce titre.

## Collecte et déploiement

Google Jobs conserve 94 recherches universelles, PME/TPE/start-up/association et
sectorielles, avec quotas persistants. France Travail parcourt les 1 584 métiers
ROME avec curseur et budget borné ; LBA peut recevoir les relais FT. L’accès aux
sources dépend des clés réelles de l’environnement, sans secret navigateur.

`npm run maintain:offers` exécute collecte, conformité et contrôle de disponibilité.
Le rapport est privé dans `.local/maintenance-last.json` (ou `DATA_DIR`).
`npm run export:market` écrit les offres LBA récentes admissibles dans un fichier
distinct `config/recent-market-offers.json`, sans écraser l’archive suspendue.
Les références employeurs récentes sont préparées au démarrage, y compris sur
une nouvelle instance Render, avec les dates originales et sans faux contrôle.

Les tests locaux ne prouvent ni le déploiement Render ni la disponibilité des pages
employeurs bloquées par le réseau. Le [bilan initial de l’audit](OFFERS_AUDIT_2026-11-02.md)
conserve les observations avant ce changement de règle ; il ne décrit plus le
nombre d’offres visibles après rétablissement.

## Ajout SNCF issu des fichiers fournis

Un stage SNCF Réseau publié le 2 novembre est ajouté aux 24 annonces précédentes, soit 25 offres publiques sur la base locale à cette date. Après confirmation explicite du responsable, les vingt alternances du MHTML sont également publiques, soit 45 offres au total localement. Leur date de publication n’est pas fournie : une exception éditoriale de 30 jours, limitée à ces identifiants et sans rajeunissement automatique, conserve cette information manquante. Aucune date d’enregistrement n’est utilisée à la place. Voir [le bilan des deux fichiers](SNCF_UPLOAD.md).

Le fichier SNCF R.mhtml fournit ensuite 20 stages, dont le stage daté déjà présent :
19 nouveaux stages sont intégrés sans doublon. Le catalogue local passe à 64 offres,
dont 40 SNCF (20 stages et 20 alternances). Le second lot de confirmation n’allonge
pas le délai du premier. Les logos des entités SNCF présents dans les captures sont
servis localement ; les autres entreprises conservent leur logo fourni ou les
icônes officielles avec repli.

L’import de la première page TotalEnergies ajoute ensuite 20 stages réellement
datés, dans plusieurs domaines, soit 84 offres locales. Leur pays est explicitement
France, mais aucune ville ou région n’est inventée. Les 16 annonces de la page 2
n’ont pas été capturées. Voir [la provenance TotalEnergies](TOTALENERGIES_UPLOAD.md).

Le fichier Airbus « Search for Jobs.html » ajoute 20 stages de la première page
Workday (445 résultats annoncés, pas tous capturés). « Posted Today » reste une
indication relative, avec une observation de fichier fixe et un intervalle
conservateur, sans date exacte inventée ni rajeunissement au déploiement.
Le catalogue local passe à 104 offres. Voir [l’audit Airbus](AIRBUS_UPLOAD.md).

Les deux fichiers Orange ajoutent ensuite 10 stages et une alternance française,
avec leurs dates initiales et les résumés réellement fournis. Neuf autres fiches
sont exclues (huit hors France et un contrat stage/alternance non établi).
Le catalogue local atteint 115 offres ; le logo Orange est servi localement.
Voir [la provenance Orange](ORANGE_UPLOAD.md).

Le document Thales du 3 novembre apporte un stage français récent, publié le
14 octobre à Élancourt. Les neuf autres fiches sont hors France ou anciennes et
sans contrat admissible établi. Le catalogue local passe à 116 offres.
Voir [la provenance Thales](THALES_UPLOAD.md).
