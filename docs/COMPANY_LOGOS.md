# Logos des entreprises

`CompanyLogo` conserve une boîte fixe et un affichage `object-fit: contain`.
L’image est chargée paresseusement, sans référent transmis. Le logo local de
l’entité SNCF est prioritaire, puis le logo HTTPS explicitement fourni. Les images
HTTP, URL contenant des identifiants et URL non interprétables ne sont pas acceptées
comme logos fournis. Les erreurs passent au candidat suivant et finissent sur
un monogramme en SVG ; aucun dessin de marque n’est généré.

Assets repris des archives employeur fournies :

| Fichier | Identité | Provenance |
| --- | --- | --- |
| `sncf.svg` | SNCF | SVG d’en-tête du premier MHTML |
| `sncf-reseau.avif` | SNCF Réseau | image d’entreprise du premier MHTML |
| `sncf-voyageurs.avif` | SNCF Voyageurs | image d’entreprise de SNCF R.mhtml |
| `sncf-gares-connexions.avif` | SNCF Gares & Connexions | image d’entreprise de SNCF R.mhtml |

Les marques restent la propriété de leurs titulaires. Ces images identifient
les employeurs ; leur présence ne signifie pas partenariat ou parrainage.

Quand aucun logo n’a été fourni, l’icône officielle est tentée directement sur le
site de l’entreprise, puis auprès des services Google et DuckDuckGo. Le nom
accessible précise « Icône », pour ne pas assimiler un favicon à un logo intégral.
Les services externes peuvent être bloqués ou indisponibles : seul le chargement
effectif dans le navigateur permet de confirmer l’affichage. Le logo local SNCF
n’utilise aucun de ces services. Aucun secret/API payante n’est nécessaire.
