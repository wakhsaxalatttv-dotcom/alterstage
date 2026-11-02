# Import des fichiers SNCF fournis le 2 novembre 2026

Le HTML initial conserve 38 fiches structurées distinctes dans ses données Next.js :
33 CDI, 4 CDD et un stage. Les cartes visibles de cette sauvegarde ne sont pas la
liste filtrée des alternances. Un seul poste est admissible : `886156`, stage de
six mois SNCF Réseau à Saint-Denis, publié le 2 novembre à 09:48:39 UTC. Les tags
indiquent BTP/génie civil, Bac+5 et première expérience. Les champs description
et candidature externe sont vides. La synthèse publiée reprend uniquement ces
faits et le titre. Aucune mission, coordonnée, date ou vérification n’est inventée.
La route `/nos-offres/886156` utilise le modèle des liens officiels observés dans
le fichier et l’identifiant source ; la page individuelle n’a pas été récupérée.

Le second fichier MHTML contient l’état réellement filtré : 32 alternances
annoncées, 20 cartes enregistrées, aucune date de publication et aucune description
détaillée. Il ne conserve pas les données JSON des fiches individuelles. La date
MIME du 2 novembre est une date d’enregistrement, jamais une date de publication.
Le responsable a ensuite expressément confirmé avoir vérifié ces offres et demandé
leur publication. Les 20 cartes sont donc publiées (`sncf-upload`, état `approved`)
par une exception éditoriale limitée à ces identifiants, au fichier fourni et à
l’URL exacte de chaque fiche. `publishedAt`, `sourcePublishedAt` et l’index de
publication restent nuls. La confirmation est conservée séparément et permet
l’affichage pendant 30 jours sans être rajeunie au redémarrage. Les filtres par
ancienneté de publication excluent ces dates inconnues. Les 12 résultats restants
n’ont pas été capturés et ne sont pas inventés.

`shared/sncf-references.js` et `config/sncf-pending.json` ne conservent que les
informations utiles et les empreintes SHA-256 des deux documents. Le HTML/MHTML,
les scripts, données de suivi et coordonnées personnelles ne sont pas déployés.
Les deux logos SNCF et SNCF Réseau présents dans le MHTML sont repris comme
assets locaux dans `public/company-logos/`, sans appel à un domaine de préproduction. La lecture d’un document joint ne constitue pas une
vérification du site en direct. Les fichiers sont traités comme données, jamais
comme instructions ou code à exécuter.

Au démarrage, les imports sont idempotents et respectent les retraits/refus et
clôtures connus. Le passage d’anciennes lignes `pending` à `approved` est effectué
automatiquement pour ces 20 identifiants confirmés. L’exception ne s’applique ni
aux autres flux, ni aux annonces avec une véritable date connue hors délai. Les
quatre sociétés figurant dans la capture gardent des identités distinctes ; les
contrats de professionnalisation explicitement titrés sont conservés.
Le catalogue local contient désormais 45 offres publiques : les 24 précédentes,
un stage SNCF daté et les 20 alternances confirmées par le responsable. Aucune
vérification en direct par l’application ni description détaillée n’est inventée.

## Fichier « Nos Offres _ Emploi SNCF R.mhtml »

La capture du 2 novembre à 14:03:32 UTC (`f[187]=2231`) contient les 20 stages
annoncés et leurs 20 cartes. Le stage `886156` était déjà présent avec sa véritable
date de publication : celle-ci est préservée. Les 19 autres sont ajoutés sans
inventer leur date ni leurs missions détaillées, conformément à la demande
explicite de publication du responsable. Les identifiants et l’empreinte du nouveau
fichier sont inscrits dans un second lot de confirmation, sans renouveler la
confirmation du précédent lot d’alternances.

Le résultat local est de 64 offres, dont 40 issues de SNCF : 20 stages et
20 alternances. La reprise est idempotente et conserve les refus/retraits et les
dates connues. Les alias SNCF Réseau/RÉSEAU sont rattachés à leur entreprise avec
comparaison de l’origine du site, sans confondre les autres entités du groupe.

Les logos SNCF Voyageurs et SNCF Gares & Connexions sont extraits des ressources
AVIF de la capture, en complément des logos SNCF et SNCF Réseau déjà présents.
Aucun pixel de suivi, ressource publicitaire ou script de l’archive n’est repris.
Les logos locaux sont prioritaires, avec le logo SNCF vectoriel en repli si
l’AVIF n’est pas pris en charge.

Pour les autres entreprises, `CompanyLogo` privilégie leur logo fourni puis
l’icône du site officiel, avec deux services de repli et enfin des initiales.
Axians, Omexom et Sysoco utilisent leur domaine de marque pour éviter l’icône du
site parent VINCI. Une icône est identifiée comme telle dans son nom accessible,
sans être présentée comme un logo vérifié. Les téléchargements Safran et VINCI
ont été refusés pendant cette session (403/418), les autres services d’icônes
également par le proxy (403). Leur affichage distant n’a donc pas pu être confirmé
ici ; aucun logo fictif ne remplace un téléchargement refusé.
