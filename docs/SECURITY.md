# Sécurité et limites de la vérification

Durcissement du 3 novembre 2026. Les contrôles sont effectués en local ; le
serveur Render et les comptes fournisseurs ne sont pas accessibles depuis cet
environnement. Ce travail n'est pas une certification de sécurité.

## Protections du serveur

- Administration toujours protégée par ADMIN_TOKEN côté serveur, comparaison
  constante à longueur égale et fermeture de l'accès si la configuration manque.
- Dix échecs par IP sur quinze minutes au maximum, partagés entre les routes
  privées. Une connexion correcte réinitialise les échecs avant le blocage ;
  après blocage il faut attendre la fin de la fenêtre. Retry-After est fourni.
- Compteurs bornés à 10 000 IP par type, fenêtres expirables, pas de suppression
  d'un compteur actif pour faire de la place à un nouvel utilisateur.
- Limites existantes des dépôts (5/h) et signalements (10/h) préservées, avec
  Retry-After. Les limites sont locales au processus : elles se réinitialisent
  au redémarrage et ne constituent pas une protection distribuée contre un DDoS.
- Requêtes d'écriture cross-site refusées avant traitement ; les corps non vides
  doivent être JSON. Les clients API sans Origin et les commandes sans corps
  restent compatibles. Ceci ne remplace ni l'authentification ni un antispam.
- CSP limitant scripts et connexions à la même origine, sans scripts exécutables
  inline ; objets et cadres bloqués, encadrement du site interdit, formulaires
  limités au site. Les styles inline nécessaires à React restent autorisés ;
  les logos HTTPS externes restent autorisés. Le JSON-LD SEO n'est pas exécutable.
- X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy et protection
  de l'opener. HSTS d'un an et upgrade-insecure-requests uniquement en HTTPS.
- En-têtes no-store sur les API et l'administration ; noindex sur cette dernière.

Le reverse proxy est accepté sur un seul saut lorsque RENDER=true, comme avant.
Ne pas exposer le processus Node directement à Internet en ajoutant une chaîne
arbitraire de proxies : la fiabilité des limites dépend de l'IP transmise par
l'infrastructure. Les protections du navigateur ne rendent pas un code divulgué
inutilisable et n'empêchent pas tout abus venant d'un client automatisé.

## Secrets et exploitation Render

Le code d'administration figurait dans les anciennes captures fournies. Il faut
le remplacer dans Render → Environment → ADMIN_TOKEN par un secret aléatoire
unique, puis redéployer. Ne pas réutiliser un nom, une phrase ou une clé API comme
code. Pour produire une valeur, utiliser localement un gestionnaire de mots de
passe ou `openssl rand -hex 32`, puis la conserver hors du dépôt et du chat.
Cette rotation Render n'est pas effectuée par le présent changement et ne doit
pas être confondue avec `npm run setup:admin`, qui configure uniquement .env local.
Changer aussi toute clé fournisseur affichée dans des captures si elle est encore
utilisée. Ne jamais exposer de secret via une variable VITE_.

Vérifier les protections après le déploiement, conserver le disque DATA_DIR et
ses sauvegardes, et limiter l'accès aux comptes GitHub et Render (MFA). Aucune
annonce existante n'est supprimée et aucune clé n'est modifiée implicitement.

## Audit des dépendances

`npm audit --json` et `npm audit --omit=dev --json` : aucune alerte élevée,
critique ou modérée ; deux alertes faibles concernant deepmerge 4.3.1 et son
parent html-to-text 9.0.5. L'avis GHSA-gcqx-w48m-w2h4 décrit l'empoisonnement
possible des objets retournés par mergeObject. Aucun correctif n'est proposé
par npm à cette date. html-to-text est utilisé dans server/enrichment.js avec
une configuration fixe du programme, sans fusion d'options venant de l'utilisateur.
Le HTML non fiable est du contenu à convertir, jamais une configuration à fusionner.
L'alerte reste à surveiller ; elle n'est ni masquée, ni déclarée corrigée.
