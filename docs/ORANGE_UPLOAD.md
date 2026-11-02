# Import des deux fichiers Orange — 2 novembre 2026

Les documents fournis sont lus comme HTML et données JSON, sans exécuter leurs
scripts. Seuls les objets contenant une identité de poste sont extraits des
assignations JSON ; les configurations, cookies, données de suivi et registres
Phenom ne sont pas déployés.

- `Offres d’emploi chez Orange _ Orange Jobs.html` : SHA-256
  `2d71215114fdade00ab3cd9e55f2cecc64fb9496dcc48a0fcdfe1c382c3dd21c`.
  Dix fiches structurées, toutes françaises et de type Stage, avec leurs liens
  de détail Orange présents dans les cartes visibles.
- `Offres d’emploi chez Orange _ Orange Jo.html` : SHA-256
  `004d4727b3f4a3b43a8e373a1096efb98be3fd5e180dc4f88a84e2788a78fb13`.
  Dix fiches structurées malgré une page visible presque vide : une alternance
  explicitement titrée à Nanterre, une offre française sans contrat de stage ou
  alternance établi, et huit offres en Belgique. Seule l’alternance est importée.

Le résultat est de 11 offres nouvelles, sans doublon : 10 stages Orange SA et
une alternance Orange Cyberdefense. Le catalogue local passe de 104 à 115 offres.
Les 179 résultats annoncés par la première page ne sont pas tous conservés dans
le fichier et ne sont pas revendiqués comme importés.

## Dates, lieux et contrats

La date initiale `dateCreated` du portail est retenue, sans la remplacer par son
`postedDate` plus récent. Le stage CTS-2026-54624 conserve ainsi le 8 octobre et
l’alternance IOS-2026-2784 le 19 octobre, même si `postedDate` vaut le 2 novembre.
Les deux timestamps sont conservés séparément (ISO normalisé, même instant) ;
`postedDate` n’est pas présenté comme une vérification ou un renouvellement humain.
Les onze dates initiales respectent la limite de 30 jours à la date d’import.

Les villes et adresses/postaux sont présents. Les départements 35, 92, 94, 14 et
22 établissent leurs régions, sans commune INSEE ni adresse inventée. Les résumés
reprennent le `descriptionTeaser` fourni, pas une description complète prétendument
consultée. Une durée n’est ajoutée que lorsque « 6 mois » apparaît dans le titre
ou le résumé. Aucun diplôme, salaire, mission détaillée ou contact n’est inventé.
Le sous-type apprentissage/professionnalisation reste non précisé pour l’alternance.

Les dix liens de stage viennent des ancres HTML. Pour l’alternance, le lien
`applyUrl` ICIMS fourni dans les données est conservé, sans fabriquer une route
Orange absente du fichier. Les conditions et formulaires en direct n’ont pas été
vérifiés : `lastVerifiedAt` reste nul. Les retraits/refus antérieurs sont respectés
et le redémarrage ne duplique pas les fiches.

## Logo et validation

`public/company-logos/orange.svg` est repris sans modification visuelle du dépôt
Orange Open Source, version fixée :
`https://raw.githubusercontent.com/Orange-OpenSource/Orange-Boosted-Bootstrap/v5.3.3/site/static/docs/5.3/assets/brand/orange-logo.svg`.
Le SVG utilise uniquement svg/defs/style/path, sans événement, lien externe,
script, import CSS ou URL de ressource. Sa présentation responsive est celle de
l’asset officiel. Pour Orange Cyberdefense, son nom accessible précise qu’il
s’agit du logo du groupe Orange. Aucun partenariat n’est revendiqué.

Les tests couvrent les onze postes, pays/contrats admis, dates initiales distinctes
de la date de portail, liens exacts, localisations, classement, absence de faux
badge, idempotence et retrait durable. Le navigateur local vérifie onze réponses
de fiches, onze logos effectivement chargés, candidature ICIMS et absence de
régression de format mobile/ordinateur. Cela ne certifie pas l’état de Render.
