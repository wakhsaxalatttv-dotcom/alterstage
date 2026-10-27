# Brancher un flux autorisé

Le pipeline fonctionne sans source et ne génère aucune annonce. `config/sources.example.json` contient une liste vide volontairement. Aucun flux France Travail, Dares ou tiers n’est connecté par défaut.

## Configuration serveur

Créer un fichier **local privé**, par exemple `.local/sources.json`, puis définir :

```dotenv
SOURCES_FILE=.local/sources.json
INGEST_INTERVAL_MINUTES=0
```

Format d’une entrée (valeurs entre chevrons à remplacer ; ce ne sont pas des URL de flux réels) :

```json
{
  "id": "identifiant-stable",
  "name": "Nom fourni par l’éditeur",
  "kind": "json",
  "url": "<URL HTTPS réelle du flux autorisé>",
  "allowedHosts": ["<hôte exact du flux>"],
  "enabled": false,
  "authorized": false,
  "licenseUrl": "<page des conditions ou de l’autorisation>",
  "authorizationRef": "<référence d’accord facultative, sans secret>",
  "tokenEnv": "<nom facultatif d’une variable serveur>",
  "defaults": {}
}
```

Placer les entrées dans une liste JSON. Au maximum 30 sources ; `id` unique en minuscules/chiffres/tirets. Ne passer `enabled` et `authorized` à `true` qu’après avoir vérifié les conditions et votre autorisation réelle. Le responsable doit garder la preuve des droits ; cocher un booléen ne crée pas ces droits. Enlever `tokenEnv` si le flux ne demande pas de token. Les secrets restent dans les variables sécurisées de l’hébergeur, jamais dans ce fichier ou le navigateur.

Le nom d’hôte exact doit aussi être accessible dans les règles réseau de l’environnement. Les redirections ne sont pas suivies : configurer l’adresse finale autorisée. Transport HTTPS avec vérification TLS, refus des IP/hôtes locaux et des résultats DNS privés (résolution épinglée en connexion directe ; contrôle local préalable puis routage par le proxy si `HTTPS_PROXY` / `HTTP_PROXY` sont configurés), limite 2 Mo, délai 15 secondes, au maximum 500 éléments traités par source et par collecte. Les flux trop volumineux échouent explicitement ; la pagination distante automatique n’est pas implémentée. Un flux de plus de 500 éléments est une sélection tronquée, jamais présenté comme exhaustif. Le journal compte les éléments traités et ne permet pas de déduire la disparition d’une offre à partir de son absence.

## Connecteur JSON

Réponse attendue : liste d’objets ou `{ "offers": [...] }`. Chaque objet utilise les champs du formulaire entreprise : `externalId`, `title`, `companyName`, `companyWebsite`, `sourceUrl`, `applicationUrl` facultatif, `city`, `region` française, `domain` de `shared/catalog.js`, `contract` (`Stage`, `Apprentissage`, `Contrat de professionnalisation`), `description`, `publishedAt` réel (ISO ou date interprétable), `education` facultatif (libellé source), missions/compétences facultatives (texte, une par ligne). `sourceUpdatedAt` facultatif est conservé uniquement s’il vient réellement de la source.

Les champs structurés manquants ne sont pas inventés : une offre incomplète, hors périmètre, sans date ou trop ancienne est comptée invalide. Les domaines et régions doivent être mappés explicitement par le fournisseur ou un nouvel adaptateur spécifique, pas devinés par mots-clés. Les technologies/niveaux/villes extraits sont des _mentions à relire_. Une compétence mentionnée n’est pas nécessairement exigée. Les contacts ne sont jamais extraits des annonces du flux ; ils doivent être saisis séparément via un dépôt autorisé, avec provenance et contrôle humain.

Si `expiresAt` n’est pas fourni, une échéance **interne** est définie à publication + 30 jours, sans prétendre qu’il s’agit de la date de fermeture de l’employeur. Une date future de publication est refusée. La date originale normalisée complète est conservée dans `sourcePublishedAt`, la date d’actualisation source dans `sourceUpdatedAt`, la réception dans `firstRetrievedAt` / `lastFetchedAt`. Ces dates ne sont pas interchangeables.

## Connecteur RSS / Atom

`kind: "rss"`. Prend en charge `item` RSS et `entry` Atom : titre, lien original, description/contenu, guid/id, pubDate/published et updated. Sans date de publication réelle, l’élément est invalide. Les déclarations DOCTYPE/ENTITY sont refusées. Les valeurs structurées manquantes (entreprise, domaine, lieu, contrat) peuvent être indiquées dans `defaults` **uniquement si elles décrivent réellement toutes les annonces du flux**, par accord avec l’éditeur. Ne pas utiliser ce mécanisme pour assimiler tous les types d’alternance à un contrat précis ou tous les postes à une même ville.

La logique spécifique à une autre API doit être ajoutée dans `server/ingestion/connectors.js`, derrière le même contrat et les mêmes contrôles. Un accès public n’est pas une autorisation de scraping ni de republication. Les conditions des partenaires s’appliquent aussi ; une API qui ne donne que des statistiques (par exemple certains jeux Dares) ne produit pas des annonces d’emploi.

## Exécution et revue

```sh
npm run ingest
```

Ou **Modération → Sources & collecte → Lancer une collecte**. L’API répond `202` et le panneau suit le journal par interrogation périodique, sans bloquer une requête HTTP pendant toute la collecte. Le panneau indique « Source non configurée » si aucune source n’existe, les erreurs par source et les derniers résultats. Un échec de source n’empêche pas les suivantes. Aucune erreur ne transforme un catalogue ancien en catalogue revérifié.

Avec `INGEST_INTERVAL_MINUTES` d’au moins 5, le serveur lance une collecte périodique pendant qu’il tourne. Une seule collecte à la fois dans ce processus ; ne pas activer plusieurs planificateurs pour la même base. Un hébergeur qui met le serveur en veille ne garantit pas la périodicité : utiliser alors un worker planifié externe qui exécute `npm run ingest`, sur le même disque/base, sans lui envoyer de données secrètes en argument.

Les nouveaux postes vont dans la file privée. Une collecte inchangée ne redonne aucune vérification. Une modification de contenu révoque la vérification et remet en attente en conservant la première récupération. Une source tronquée ou un échec réseau n’entraîne pas de retrait automatique ; l’échéance interne et la modération limitent la durée d’affichage. La revue humaine reste nécessaire avant chaque publication, puis au moins tous les sept jours pour garder le badge actif. Les offres plus anciennes que 30 jours ne peuvent pas être nouvellement approuvées.
