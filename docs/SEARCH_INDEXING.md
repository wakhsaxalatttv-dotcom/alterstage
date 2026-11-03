# Faire apparaître Offres Fraîches dans les recherches

Le référencement technique prépare l’exploration ; il ne constitue ni une
soumission à Google, ni une preuve d’indexation, ni une garantie de classement.
L’adresse publique actuelle est https://alterstage.onrender.com/.

## Configuration livrée

- Titre, description et données structurées WebSite avec le nom du site
  et la variante sans accent « Offres Fraiches ».
- URL canonique, métadonnées de partage et texte pour les visiteurs sans JavaScript.
- `/robots.txt` et `/sitemap.xml` servis comme fichiers publics.
- L’administration reste exclue par robots.txt et son en-tête existant
  `X-Robots-Tag: noindex, nofollow, noarchive`.

Le sitemap contient seulement l’accueil : les rubriques actuelles sont des vues
de cette application, pas des pages indépendantes. Les liens employeurs externes
ne sont pas inclus. Aucune donnée JobPosting ou évaluation fictive n’est ajoutée.
Les API nécessaires au rendu public des offres restent explorables.

## Après le déploiement Render

1. Ouvrir https://search.google.com/search-console avec le compte du propriétaire.
2. Ajouter une propriété **URL prefix / Préfixe de l’URL**, exactement
   `https://alterstage.onrender.com/`. Une propriété de domaine onrender.com
   ne convient pas : le propriétaire du site ne contrôle pas son DNS.
3. Choisir **HTML tag / Balise HTML**, copier la balise
   `google-site-verification`, l’ajouter au head de index.html, redéployer,
   puis cliquer sur **Verify / Valider**. Cette balise est publique ; aucun
   mot de passe Google ou clé API n’est nécessaire dans la conversation.
4. Dans **Sitemaps**, soumettre `sitemap.xml`.
5. Dans **URL inspection / Inspection de l’URL**, inspecter l’accueil, lancer
   le test en direct et demander l’indexation si Google l’autorise.

Search Console permet de connaître l’état d’indexation et les problèmes
d’exploration observés par Google. La présence et le classement pour le nom
du site ne peuvent pas être garantis. La recherche `site:` n’est pas un
inventaire exhaustif de l’index.

Un nom de domaine propre est facultatif. S’il est ajouté plus tard, mettre
à jour ensemble la canonique, og:url, les données structurées, robots.txt et
sitemap.xml, puis les redirections et la propriété Search Console.
