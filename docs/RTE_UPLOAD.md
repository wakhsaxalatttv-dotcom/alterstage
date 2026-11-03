# Analyse du fichier RTE

Fichier « Toutes nos offres _ RTE.html » du 3 novembre 2026.
SHA-256 `7096fcf22b48a8882e4f6a2ffdaab5a43ab8dc85ef6f91144dbb19cf67a1efb7`.

Le compteur affiche 46 offres ; seules 21 fiches sont présentes, toutes des
stages français, avec référence, département, famille métier et lien employeur.
La pagination restante n'est pas jointe et aucune date de publication n'est
fournie, ni dans les cartes ni dans des métadonnées de poste. L'accès à une
fiche officielle est bloqué par le proxy CONNECT 403.

Les 21 fiches exactes sont conservées dans config/rte-pending.json, sans
publication automatique ni ville, date, missions, formation ou durée inventées.
Les exceptions nominatives SNCF et Toyota ne sont pas étendues implicitement.
Aucune offre existante n'est retirée.

Le logo RTE est le SVG intégré au HTML fourni, extrait sans modification
visuelle. Ses balises et attributs sont contrôlés : aucun script, attribut
événement ou lien externe ; les références internes SVG sont conservées.
Il est servi localement par CompanyLogo.

## Publication confirmée

Le responsable a expressément confirmé l'ajout de ces 21 stages. Exception
strictement limitée aux identifiants, liens et empreinte du document fourni.
La confirmation est enregistrée une seule fois le 3 novembre 2026 et expire
après 30 jours sans renouvellement au redémarrage. Les dates de publication
restent absentes et aucun contrôle automatique en ligne n'est affirmé.
Les localisations affichent les départements fournis, sans inventer de ville.
Un retrait ou une clôture connus restent prioritaires.
