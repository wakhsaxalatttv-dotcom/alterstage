# Import Airbus « Search for Jobs.html » — 2 novembre 2026

Le document fourni conserve la première page Workday d’Airbus, avec les filtres
France et « Trainee / Student (Fixed Term) ». Il contient 20 fiches de stage parmi
445 résultats annoncés, et non les 445 offres. Les pages non fournies ne sont
pas inventées. Aucun script, cookie, jeton, identifiant de suivi ou document
complet n’est déployé.

SHA-256 du fichier :
`ebd0fc83f3c049784977567bdecc626ae6a324ea12561dd4e0f3c64dbf1dbf8e`.

## Dates et lieux sans invention

Les 20 cartes indiquent « Posted Today ». Elles ne donnent pas de date exacte.
`publishedAt` et `sourcePublishedAt` restent donc nuls. Le texte est conservé dans
`publicationEvidence`, avec sa première observation du fichier, le 2 novembre,
et `observationKind: uploaded-file`. L’observation ne certifie pas une consultation
en direct du site ni l’heure de sauvegarde originale du document. Les intitulés
« Stage 2027 » désignent le stage annoncé, pas une publication en 2027.

Pour le classement et l’expiration, Today constitue un intervalle prudent de
48 heures précédant cette observation, sans supposer le fuseau du portail. Seul
l’intervalle interne est indexé : l’interface affiche le texte source et la date
de lecture, jamais cette borne comme date de publication. La preuve est limitée
au fichier, aux 20 identifiants et aux URL exactes listées dans
`shared/airbus-publication-evidence.js`. Elle est fixe, ne se rajeunit pas lors
d’un déploiement et vieillit hors des 30 jours. Un flux arbitraire ne bénéficie
pas de cette admission. Une véritable date de publication ultérieurement fournie
reste prioritaire.

Les lieux restent Toulouse Area, Nantes Area, Saint Nazaire Area, Antibes Area et
Rochefort. Les régions françaises correspondantes sont renseignées, sans inventer
l’adresse, la commune exacte d’un bassin d’emploi ou un site de l’entreprise.
La liste ne fournit ni niveau de diplôme, durée, salaire, entité juridique précise
ni missions détaillées. Les synthèses reprennent uniquement le titre, le lieu et
le libellé de publication, avec le lien Workday original. Aucun badge de contrôle
humain ou contrôle de disponibilité en ligne n’est créé.

## Import et logo

Les 20 références sont intégrées dans Offres et Repérées, avec dédoublonnage et
respect des retraits/refus. Le catalogue local passe de 84 à 104 offres. Les fiches
individuelles Workday n’ont pas été récupérées : les liens sont ceux du document
fourni, pas des candidatures inventées. Le premier bloc annonce uniquement
l’Airbus Careers group ; aucune filiale non indiquée n’est attribuée aux stages.

Le logo vectoriel local `public/company-logos/airbus.svg` est le pictogramme
Airbus de la collection Simple Icons, téléchargé sans modification visuelle depuis
`https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/airbus.svg`.
Le XML a été contrôlé : uniquement svg/title/path, aucun script ni référence
externe. Le logo ne dépend plus d’un service de favicon. Les marques restent la
propriété de leurs titulaires et aucun partenariat n’est revendiqué.

Les tests couvrent les 20 importations, indices de publication relatifs et leur
expiration, refus des preuves modifiées, filtres région/contrat, identité source,
retraits persistants, absence de dates et de missions inventées. Le navigateur
local vérifie les fiches, le texte Airbus, le vrai SVG chargé et les formats
mobile/ordinateur. Ce contrôle n’est pas un contrôle du site Render déployé.
