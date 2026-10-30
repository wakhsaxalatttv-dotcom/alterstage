# Maintenance : stages et alternances tous secteurs

## Périmètre livré

Les 21 domaines techniques existants sont conservés et complétés par 21 domaines de commerce, communication, gestion, santé, services, culture, transport, agriculture, artisanat et autres métiers. Les contrats restent stage, apprentissage, professionnalisation et alternance sans sous-type fourni. Aucun CDI, emploi ordinaire, offre Meteojob, annonce de recette ou annonce d’école détectée n’est autorisé par cet élargissement.

La classification Google Jobs lit le titre et les informations de l’annonce, sans utiliser la requête comme preuve du métier ou du contrat. Les fonctions commerciales/RH ne sont plus exclues. Un domaine non déterminable reste « Autres domaines », sans transformer le métier en informatique.

## Catalogue de démarrage dans Offres

`seedEditorialCatalogue` reprend les 30 annonces employeurs déjà documentées dans les fichiers de références du projet. Au 30 octobre 2026, 29 respectent les limites du modèle sur une base propre. La date originale et le lien officiel restent identiques ; la dernière consultation reste celle enregistrée dans les données, pas la date du déploiement. Les textes sont des synthèses éditoriales existantes. La carte et le détail le précisent. Aucune disponibilité actuelle ni nouvelle vérification n’est prétendue.

Le démarrage peut donc publier ces annonces admissibles même si aucune nouvelle API ne répond, sans créer de fausses entreprises ni d’annonces de démonstration. Ce n’est pas une nouvelle collecte en direct. Les anciennes annonces de plus de 45 jours, les délais locaux dépassés et les références retirées restent exclus. Les décisions de retrait et les doublons empêchent la réapparition au redémarrage. Le nombre réellement disponible peut être inférieur, selon la date et la base déployée.

## Collecte élargie

Le référentiel ROME complet contient 1 584 métiers (familles A à N), téléchargés depuis le CSV officiel déjà référencé par le projet. Le JSON inclut maintenant les libellés et leur provenance. LBA n’envoie plus une restriction aux seuls codes techniques ; cela évite aussi une URL démesurée. France Travail normalise toutes les familles et conserve les spécialisations techniques existantes. Une collecte FT interrompue reprend au prochain métier via le curseur SQLite, au lieu de recommencer indéfiniment au premier secteur. Budget FT par défaut : 2 000 requêtes, toujours borné et avec couverture partielle déclarée si nécessaire.

Google Jobs ajoute des recherches universelles « stage » et « alternance », puis des requêtes PME, TPE, start-up et association, avant la rotation par secteur. Les petites structures ne sont pas écartées ; un résultat trouvé avec « PME » n’est pas pour autant labellisé PME sans donnée de taille. Les plafonds existants de trois appels/heure et 24/jour restent en place. Les quotas ou erreurs fournisseur peuvent limiter la collecte ; aucune exhaustivité de marché n’est annoncée.

La clé LBA disponible dans la configuration locale a permis une collecte réelle le 30 octobre 2026 : 326 annonces reçues, dont 57 Meteojob, 55 de recette/sandbox et 21 insuffisamment renseignées écartées avant normalisation. Les 193 résultats restants se dédoublonnent en 105 offres publiques uniques. L’instantané nettoyé les conserve sans clé ni coordonnées personnelles, avec dates et partenaires d’origine. Les doublons ne sont pas comptés comme nouvelles offres.

Les relais France Travail fournis par LBA sont désormais admis avec leur provenance : cela n’active pas le connecteur OAuth direct et n’invente aucun identifiant FT. L’inclusion est contrôlée par le connecteur LBA officiel ; un flux arbitraire ne peut pas se faire passer pour cet accès. Les liens locaux, de recette, de préproduction ou les annonces explicitement de test restent rejetés, même si l’API les renvoie actives.

Le catalogue préparé contient ainsi 105 alternances reçues par API et 29 annonces employeurs déjà sourcées, soit 134 offres sur base propre à la date de collecte. La disponibilité n’est pas revérifiée humainement. Les clés présentes sur Render seront utilisées au démarrage ; son accès reste bloqué depuis le workspace. Le déploiement et son propre état doivent donc être confirmés séparément.

## Repérées : stages, alternances, toutes entreprises

La rubrique combine les liens éditoriaux et les annonces publiques des connecteurs, dédoublonnés par URL. Les données dynamiques sont limitées aux 200 plus récentes dans cette vue complémentaire ; toutes les annonces publiques restent accessibles dans Offres avec sa pagination serveur. Il n’existe aucun filtre caché sur les grands groupes, les ESN, les PME ou les associations.

Un filtre de contrat, les domaines présents, la recherche et la pagination de 20 cartes permettent de distinguer stages et alternances. Les descriptions, missions et informations d’entreprise proviennent des données disponibles ; les champs absents ne sont pas inventés. Les légendes distinguent une synthèse éditoriale et une description reçue par API. Un signalement suivi d’un retrait masque le même poste dans Offres et Repérées ; il reste retiré après redémarrage.

## Vérification

`npm test` couvre l’admission des nouveaux secteurs, les familles ROME, la reprise FT, le catalogue de démarrage, l’absence de fausse vérification et les retraits croisés. Les parcours navigateur vérifient la recherche, les deux rubriques, les contrats et les tailles de téléphone/ordinateur. Les offres fictives utilisées pour les tests restent exclusivement dans des bases temporaires.
