# Import TotalEnergies du 2 novembre 2026

Source : fichier fourni « Latest Jobs (page 1 in 2) _ Careers Portal -
TotalEnergies.html ». SHA-256 :
`b36b5190b2a81925f1d08d0f6e438baf511780504fdf5ee2594bba61ce6d41ee`.
Le HTML est lu comme données ; aucun script ou registre de suivi n’est exécuté
ou déployé.

## Données réellement présentes

La première page contient 20 fiches distinctes sur 36 résultats annoncés. Elles
sont toutes marquées « France », « Stage conventionné », avec une véritable date
de publication entre le 14 et le 30 octobre 2026. Les titres, huit employeurs,
liens de détail et liens `ApplicationMethods?jobId=…` sont repris exactement. Les
employeurs comprennent les entités TotalEnergies, AS 24 France et Fonroche.
La deuxième page et ses 16 résultats ne figurent pas dans le document et n’ont
pas été inventés.

Le fichier n’indique ni ville précise, ni description complète, ni missions,
durée ou salaire. Les synthèses se limitent aux métadonnées présentes et renvoient
à la fiche officielle. Seul le titre explicitement Bac+5 est étiqueté ainsi. Aucun
contact n’est extrait et aucun badge de vérification humaine n’est ajouté.

## Localisation et catalogue

Un import éditorial de confiance peut désormais conserver un pays français
explicitement fourni sans inventer sa ville ou sa région :
`location = { label: "France", region: "", commune: null, countryCode: "FR",
precision: "country" }`.
L’option `allowCountryOnlyLocation` n’est pas activée par les dépôts publics ni
les flux arbitraires. Un pays étranger ou une région/cité inventée ne bénéficie
pas de cette exception. Les filtres ville/région n’incluent pas abusivement ces
annonces dans une localisation non fournie.

Les dates originales sont appliquées à la limite de 30 jours et restent distinctes
de la consultation du document. Le chargement au démarrage est idempotent,
respecte les retraits/refus et classe les 20 offres dans Offres et Repérées.
Le catalogue local passe de 64 à 84 offres. Un déploiement neuf prépare les mêmes
données tant que leurs dates et la modération le permettent.

## Logo et vérifications

Le CSS et la métadonnée OpenGraph du document donnent l’URL officielle
`https://jobs.totalenergies.com/portal/4/images/logo.webp`. Elle est référencée
pour les entreprises nommées TotalEnergies, avec les replis habituels. L’image
n’est pas incorporée au HTML fourni. Ses octets n’ont pas pu être téléchargés :
le proxy a refusé l’accès au logo, à la deuxième page et à une fiche individuelle
(CONNECT HTTP 403). La disponibilité des candidatures en direct et le chargement
distant du logo ne sont donc pas certifiés par cette session.

Les tests contrôlent les 20 ajouts, dates, liens de candidature, huit identités
entreprise, France sans ville inventée, filtres, retrait durable, idempotence et
refus d’un pays étranger. Le parcours navigateur local vérifie 20 réponses de
fiches, liens de candidature présents, mobile/ordinateur et absence de faux badge.
