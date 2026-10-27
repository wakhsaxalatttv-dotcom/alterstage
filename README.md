# Offres Fraîches — technique & informatique

Application responsive de recherche de **stages et alternances en France**, uniquement pour les métiers techniques et informatiques. React 19 + Vite, API Express, Node.js **24 ou supérieur**. Recherche gratuite, aucun paiement. **France Travail a été retiré** ; aucune clé France Travail n’est nécessaire.

## Voir l’application dans GitHub Codespaces

Ouvrir la branche `offres-fraiches-v1`, puis **Code → Codespaces**. Dans le terminal :

```sh
npm ci
npm run setup:admin
npm run dev
```

Ouvrir le port **5173** dans l’onglet **Ports**. `setup:admin` crée un jeton aléatoire dans `.env`, ignoré par Git, sans le montrer dans les logs et sans remplacer une clé existante. Garder ce fichier privé. Dans l’éditeur de Codespaces, ouvrir `.env` pour récupérer la valeur de `ADMIN_TOKEN` et la saisir dans l’écran **Modération** (lien en bas du site). Ne jamais envoyer cette valeur dans un chat, une capture ou GitHub. Cette clé locale ne sera pas copiée dans un autre Codespace : y relancer `setup:admin` si nécessaire.

Vite relaie `/api` au serveur Express sur 3001. La clé est utilisée seulement côté serveur ; aucun préfixe `VITE_`. Les deux serveurs doivent tourner. Sans modération configurée, le catalogue démarre normalement mais les dépôts sont fermés avec un message explicite. Il n’y a pas de compte recruteur ni de validation automatique d’identité.

## Parcours disponibles

- Recherche combinée par mots-clés, région, famille **Technique / Informatique**, spécialité, formation, contrat et publication ; tri par publication décroissante.
- Spécialités : développement, IA/data, cybersécurité, réseaux/cloud, support, embarqué, tests, maintenance industrielle, électrotechnique, électronique, automatismes, mécanique, énergie, BTP, télécoms, méthodes, aéronautique/naval, procédés/matériaux, métrologie, et autres métiers de ces deux familles.
- Cartes détaillées, missions et compétences si fournies, fiche entreprise avec présentation autorisée, site et offres du catalogue, contacts publics avec provenance.
- Favoris, alertes et signalements locaux au navigateur. Pas de notifications lorsque le navigateur est fermé, pas d’e-mail automatique, pas de transmission des signalements.
- **Déposer une annonce** : formulaire entreprise, consentement, aperçu marqué brouillon, enregistrement serveur et référence de dépôt. L’annonce reste en attente et n’est pas visible aux candidats tant qu’elle n’est pas validée.
- **Entreprises** : annuaire de pistes vers les sites d’entreprises et recherches Google ciblées. Ni partenariat, ni affirmation de postes disponibles. Les liens ne constituent pas des offres importées.
- **Modération** : accès par jeton, annonces à valider / publiées / refusées / retirées, import éditorial manuel depuis une source autorisée, validation, revérification, rejet et retrait.

## Ajouter des offres réelles depuis les sites d’entreprises

1. Utiliser les liens de recherche de l’annuaire pour trouver un poste sur le site de l’employeur (ou son outil de recrutement officiel). Pas de copie d’extraits Google et pas de collecte automatisée.
2. Ouvrir l’annonce originale : vérifier le contrat, le lieu en France, la date réelle, la spécialité technique/informatique, l’entreprise et la disponibilité. Si la date manque, ne pas l’inventer : le dépôt peut être enregistré mais ne pourra pas être publié.
3. Vérifier l’autorisation de republication du texte et des données (accord de l’entreprise ou conditions de réutilisation applicables). Un accès public ou `robots.txt` ne vaut pas autorisation de réutilisation. Si elle n’est pas établie, conserver seulement une piste de recherche hors catalogue.
4. Dans **Modération → Ajouter depuis une source**, saisir les informations autorisées et les URLs réelles. Le dépôt rejoint la file d’attente.
5. Dans **À valider**, ouvrir les liens et contrôler les informations puis cocher les quatre vérifications. **Valider et publier** enregistre la date réelle de ce contrôle humain. Le formulaire ne prouve pas à lui seul l’identité du déposant ; le responsable doit la vérifier avant publication.

Le serveur ne récupère aucune URL fournie par un visiteur : ni scraping, ni requête arbitraire vers des services internes. Les futures API/flux autorisés doivent être ajoutés via `SourceConnector` et passer par la même modération. L’annuaire initial contient des pistes connues (Thales, Schneider Electric, Safran, Capgemini, Airbus, VINCI, EDF), sans reprendre leur logo ou inventer une offre. Les pages n’ont pas pu être contrôlées lors de cette mise à jour : les requêtes Google/sites d’entreprises ont été bloquées par le proxy réseau. Aucun emploi ou contact n’a donc été ajouté artificiellement.

### Contacts

Seules les boîtes **génériques** de l’entreprise (recrutement, jobs, rh, careers…) sont acceptées, sur son domaine, avec une page officielle de provenance sur ce domaine et confirmation d’autorisation de diffusion. Les adresses personnelles et les domaines externes sont refusés. Le modérateur doit contrôler la page avant publication. Aucun e-mail n’est deviné, envoyé ni extrait d’une page web. Sans contact autorisé, seul le lien de candidature est proposé.

## Fiabilité et conservation

- Un dépôt crée `firstRetrievedAt` et `submittedAt` à l’heure du serveur, jamais une date de publication inventée. `publishedAt` reste celle fournie par l’annonce source. `lastVerifiedAt` reste nul jusqu’au contrôle humain.
- La vérification expire après **7 jours** sans nouveau contrôle : statut « À vérifier ». Une publication de plus de **30 jours** porte « Offre ancienne ». Un nouveau dépôt de plus de 30 jours est refusé.
- La date d’échéance interne (maximum 90 jours) est choisie par le déposant et n’est jamais présentée comme une fermeture fournie par la source. À cette échéance, l’offre est masquée. Retrait immédiat possible par le modérateur ; aucune détection automatique des fermetures externes.
- Déduplication par URL canonique (paramètres `utm_` ignorés), identifiant, ou titre/entreprise/ville normalisés.
- Seuls les domaines et contrats de la liste autorisée sont exposés par l’API, y compris après lecture du stockage. Les anciens favoris hors périmètre ne sont plus affichés.
- Les favoris sont des copies locales possiblement obsolètes, signalées comme telles.

Le stockage utilise `.local/offers.json` par défaut, écrit atomiquement et séquentiellement dans **un seul processus Node**. `DATA_DIR` permet de choisir un disque persistant. Les dates et dépôts survivent au redémarrage si ce disque est conservé. Le fichier n’est jamais servi par HTTP ni commité. Prévoir sauvegardes et procédure de suppression des dépôts refusés. Cette version ne convient pas à plusieurs instances concurrentes partageant le fichier : migrer vers une base transactionnelle avant mise à l’échelle.

## Tests et production

```sh
npm test
npm run build
npm start
```

Express sert `dist` et `/api` sur `PORT` (3001 par défaut). Ne pas héberger `dist` seul sur GitHub Pages : l’API et les dépôts nécessitent le serveur Node. Garder le lockfile avec `npm ci`. Les tests utilisent uniquement des entreprises fictives clairement identifiées dans des dossiers temporaires et ne remplissent pas le catalogue réel.

Pour Render ou un hébergeur Node :

- Branche : `offres-fraiches-v1` ; Node : `24` ; Build : `npm ci && npm run build` ; Start : `npm start`.
- Configurer `ADMIN_TOKEN` dans les **secrets de l’hébergeur**, au moins 32 caractères aléatoires (générer localement avec `openssl rand -hex 32`). Ne pas copier le `.env` local dans le dépôt.
- Configurer `DATA_DIR` sur un **disque persistant**. Un hébergement éphémère peut perdre tous les dépôts au prochain redémarrage/déploiement ; ne pas ouvrir les dépôts publics dans ce cas. L’offre gratuite de votre hébergeur ne fournit pas nécessairement de disque persistant.
- Utiliser HTTPS. Le jeton de modération est un secret d’administration unique, saisi uniquement par le responsable ; il n’est pas stocké dans le navigateur. Remplacer par des comptes administrateurs avec rôles avant une utilisation à plusieurs.
- Dépôts limités à cinq par heure par adresse vue par Express, corps limité à 40 ko, piège antispam, validation côté serveur. Derrière un proxy, l’adresse peut être commune à plusieurs visiteurs : prévoir une limitation adaptée au proxy de confiance et une protection antispam avant ouverture à grande échelle.

## Modules

- `src/main.jsx` : écrans, filtres, favoris et alertes.
- `src/EmployerForm.jsx` : dépôt entreprise et import éditorial, aperçu et reçu.
- `src/Moderation.jsx` : accès administrateur et workflow de publication.
- `src/Companies.jsx` : annuaire de pistes et entreprises du catalogue.
- `src/components.jsx`, `src/styles.css`, `src/api.js`, `src/storage.js`, `src/domain.js` : UI et logique partagées.
- `shared/catalog.js` : familles, spécialités, contrats et annuaire.
- `server/app.js`, `server/store.js`, `server/domain.js` : routes, authentification, validation et persistance.
- `server/models.d.ts` : modèle et interfaces d’évolution.
- `test/` : tests unitaires et intégration HTTP.

La recherche reste gratuite. Le champ `sponsored` permet un futur étiquetage explicite, sans paiement ni promotion actuelle. L’ajout futur de comptes et d’alertes e-mail demandera consentement, désinscription et stockage adapté. La présente version n’envoie aucun e-mail.
