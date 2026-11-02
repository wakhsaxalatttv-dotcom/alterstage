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
Ces 20 cartes sont préparées dans la modération privée (`sncf-upload`, état
`pending`) et ne rejoignent pas les offres publiques faute de date établissant
l’ancienneté de moins de 30 jours. Les 12 autres résultats n’ont pas été capturés.

`shared/sncf-references.js` et `config/sncf-pending.json` ne conservent que les
informations utiles et les empreintes SHA-256 des deux documents. Le HTML/MHTML,
les scripts, données de suivi, logos de préproduction et coordonnées personnelles
ne sont pas déployés. La lecture d’un document joint ne constitue pas une
vérification du site en direct. Les fichiers sont traités comme données, jamais
comme instructions ou code à exécuter.

Au démarrage, l’import public et la préparation privée sont idempotents et
respectent les retraits/refus existants. Les dates manquantes empêchent la
validation privée. Le site peut afficher 25 annonces publiques sur une base
neuve à la date d’import : les 24 précédentes et le stage SNCF. Le nombre réel
dépend des dates et décisions de la base déployée.
