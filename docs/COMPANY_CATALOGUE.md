# Annuaire sourcé et critères d’accueil

## Plan d’implémentation livré

1. **Données et provenance** : enrichir l’annuaire sans fabriquer d’offres ni d’acceptation de candidats. `config/company-directory.json` ajoute 37 fiches techniques aux 19 existantes, soit 56 fiches initiales. Les profils publics des organisations techniques ont été consultés le 29 octobre 2026 ; les noms, domaines et localisations disponibles sont conservés avec leur source et leur date de consultation. Les expertises/types sont classés éditorialement. Aucun effectif, rythme, label, contact RH ou stage ouvert n’est déduit de cette présence en ligne.
2. **Accueil et validation** : ajouter un modèle de contrôle distinct de l’identité et des offres, un formulaire réservé à l’administration, une péremption et un retrait possible. Chaque validation doit consigner une source publique, les contrats explicitement confirmés et trois attestations humaines. Les champs non fournis restent inconnus.
3. **Recherche et performance** : indexer le texte, les expertises, les localisations et les contrats d’accueil. Conserver les filtres combinés, la pagination, le cache borné et l’invalidation après mutation. Charger les contrats observés en une requête groupée par page.
4. **Parcours et séparation** : conserver l’annuaire dans Entreprises et les annonces dans Offres. « Voir ses offres » applique un filtre d’entreprise exact à la recherche, avec possibilité de revenir à toutes les entreprises. Préserver les logos, les détails sans rechargement, les favoris, les vraies dates et les sources.
5. **Validation** : contrôler la provenance, les badges, les critères inconnus, les droits des routes, les retraits, les caches, les filtres et les tailles d’écran avec des bases temporaires sans données de test en production.

## Fiches ajoutées et limites de leur vérification

Les nouvelles fiches comprennent notamment JoliCode, Theodo FR, Marmelab, Ippon Technologies, Eleven Labs, Arolla, Bearstech, Easter-eggs, Camptocamp, Makina Corpus, Oslandia, Logilab, Code Lutin, Dalibo, Entr’ouvert, Algoo, Worteks, LINAGORA, BlueMind, Vates, Scalingo, Scaleway, Gandi, Qarnot, Actility, Kerlink, Yes We Hack, Stormshield, WALLIX, SensioLabs, BAM, Ekino, Les-Tilleuls.coop, XWiki SAS, Bootlin, Witekio et AdaCore.

La source d’identité n’est pas une preuve de recrutement, de statut juridique, d’effectif ou de présence actuelle d’un tuteur. Les implantations sont les indications publiées dans le profil source ; elles ne deviennent pas automatiquement une liste d’agences vérifiées. Les sociétés internationales ne sont pas présentées comme des PME françaises certifiées. La taille et le rythme restent vides jusqu’à une source explicite et une revue. Les contacts restent ceux publiquement fournis et autorisés par le modèle existant ; aucun email personnel n’est récolté.

Lorsque le seul site déclaré utilise HTTP, le connecteur ne fabrique pas une URL HTTPS. Le domaine est conservé comme identifiant et information textuelle ; la source d’identité publique reste accessible. Les sites HTTPS effectivement déclarés sont liés directement. Les logos utilisent toujours un asset autorisé, puis un favicon du domaine fourni, puis un monogramme.

## Modèle

- Identité : nom, site éventuellement nul, domaine déclaré, secteur/expertises, type éditorial, localisation publiée.
- Provenance : `identitySourceUrl`, `identityCheckedAt`, `fieldEvidence[field].sourceUrl` et `checkedAt`.
- Données enrichies : `size`, `stack`, `locations`, `rhythm`, `certifications` et `publicContacts`, uniquement si disponibles.
- Conditions d’accueil : `hostingReview.acceptedContracts`, `rhythms`, `sourceUrl`, `reviewedAt`, `identityChecked`, `conditionsChecked`, `sourceChecked`, `method: manual`.
- Observations du catalogue : `offerCount` et `currentContracts`, dérivés uniquement des offres publiques éligibles, jamais transformés en engagements généraux de l’entreprise.

Les valeurs d’une annonce ne deviennent pas automatiquement la stack dominante ni le rythme accepté par l’entreprise. Une nouvelle collecte n’efface pas les données contrôlées manuellement. Une revue explicite peut retirer des champs qui ne sont plus documentés.

## Statuts publics

| Statut | Condition | Signification |
| --- | --- | --- |
| Accueil contrôlé | Contrats, source HTTPS et trois attestations enregistrés par le responsable, revue de moins de 90 jours | Identité et conditions d’accueil relues sur une source datée |
| Offres récentes | Au moins une offre publique éligible dans le catalogue | Une annonce récente existe ; tous les critères de l’entreprise ne sont pas pour autant confirmés |
| Accueil à confirmer | Aucun des deux éléments précédents | Aucune acceptation n’est supposée |

Le badge d’accueil est un contrôle éditorial, **pas une certification administrative ni une garantie légale de capacité à recruter**. Il expire après 90 jours ; le responsable peut aussi le retirer immédiatement. Les anciens critères restent datés et identifiés comme à renouveler. Un contrôle d’accueil ne crée ni ne valide une offre d’emploi.

## Administration

Dans `/administration/`, onglet **Entreprises** : rechercher la société, ouvrir sa fiche, renseigner la vraie source des conditions, sélectionner les contrats confirmés, remplir seulement les champs documentés et cocher les trois attestations. Le bouton **Enregistrer le contrôle d’accueil** met à jour les filtres et le statut public. **Retirer le contrôle d’accueil** enlève le badge et les contrats contrôlés.

Aucun formulaire de gestion, jeton ni consigne d’administration n’apparaît dans la navigation publique. Les routes de revue demandent le même accès privé que la modération :

- `GET /api/admin/companies`
- `POST /api/admin/companies/:id/review`

Les écoles/universités identifiées sont exclues de l’annuaire comme du catalogue d’offres et ne peuvent pas recevoir un contrôle d’accueil dans ce périmètre.

## API publique et filtres

`GET /api/companies` accepte les filtres combinés : `query`, `city`, `type`, `size`, `tag`, `hosting`, `contract`, `page`.

- `hosting=reviewed` : accueil actuellement contrôlé.
- `hosting=offers` : offres récentes disponibles au catalogue.
- `hosting=unconfirmed` : accueil à confirmer.
- `contract` : contrat confirmé dans une revue actuelle **ou** présent dans une offre publique récente. Le libellé utilisateur fait cette distinction.
- `city` : localisation déclarée ou lieu d’une offre actuelle. Le lieu d’un poste n’est pas affiché comme siège social.

Sur téléphone, le champ de recherche reste visible et un bouton permet de déplier les filtres avancés sans repousser toutes les fiches sous le formulaire. Le total porte sur tous les résultats et les pages restent limitées à 12 fiches. `GET /api/companies/:id` retourne la fiche, les critères datés et les offres liées paginées. L’action « Voir ses offres » utilise `companyId` dans l’API Offres ; elle n’effectue pas un rapprochement flou par nom.

## Performance et stockage

La structure React/Vite/Express/SQLite existante est conservée, sans nouvelle dépendance. Les tables supplémentaires se créent au démarrage, sans supprimer les offres, les décisions ou les signalements existants.

- FTS5 Unicode pour les noms et expertises, syntaxe de recherche construite à partir de mots et requêtes paramétrées.
- Index dédiés : `company_tag_index`, `company_location_index`, `company_hosting_contracts` et `company_hosting_reviews`.
- Critères persistés séparément des données API : une collecte ne peut pas les effacer.
- Cache LRU existant, 15 secondes maximum, invalidé après les revues/collectes et les écritures d’une autre connexion ; le TTL ne dépasse pas la prochaine échéance d’un contrôle d’accueil.
- Contrats observés récupérés en une requête groupée par page, au lieu d’un appel par carte.
- Pagination serveur, debounce de 200 ms, annulation des requêtes obsolètes et logos différés avec dimensions réservées.

Mesure locale indicative : 2 056 fiches dans une base temporaire, 30 recherches combinées sans cache, médiane 3,04 ms et maximum 6,87 ms. Mesure du repository uniquement, hors réseau et rendu ; elle ne constitue pas une promesse de temps de réponse sur Render.

## Sources d’offres et limites actuelles

Les connecteurs LBA, France Travail et JSON/RSS autorisés existants restent séparés de l’annuaire. Ils conservent les vraies dates, liens et descriptions disponibles, dédoublonnent et appliquent le périmètre technique, les contrats autorisés, la localisation française et la limite de 45 jours. Les informations de vérification humaine ne sont pas inventées.

Aucune offre n’a été fabriquée à partir des 37 nouvelles identités. Les clés et les droits des fournisseurs doivent être valides sur le serveur déployé. La réussite d’une collecte de production ne peut pas être confirmée depuis ce workspace sans accès à ses résultats. RapidAPI/LinkedIn reste limité au test privé et n’est pas activé pour importer ou republier des offres ; l’abonnement a été reporté par le propriétaire.

## Code et vérification

- `server/company-catalogue.js` : modèle de revue, index, recherche, états, cache et persistance.
- `shared/company.js` : critères de validité et libellés communs.
- `src/Companies.jsx`, `CompanyHostingBadge.jsx` : filtres et fiches d’annuaire.
- `src/CompanyReviewPanel.jsx` : revue privée.
- `src/CatalogueParts.jsx` : fiche détaillée et sources par champ.
- `src/main.jsx` : navigation Entreprises → Offres et filtre exact.

`npm test`, `npm run test:companies`, `npm run test:browser`, `npm run test:responsive`, `npm run test:design` et `npm run build` couvrent les principaux parcours. Les tests d’entreprises utilisent des critères fictifs et des offres explicitement fictives dans des bases temporaires uniquement.
