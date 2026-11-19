# Comptes candidats — Supabase

## Ce qui est implémenté

Le catalogue et la modération des offres restent dans leur stockage actuel. Les comptes utilisent Supabase Auth et les tables PostgreSQL `of_*`, séparées des offres. L’authentification, les confirmations d’e-mail et la récupération du mot de passe sont déléguées à Supabase. Aucun mot de passe en clair n’est conservé par l’application.

Les sessions passent par le serveur Express : cookies HttpOnly, SameSite=Lax, Secure en production, protection CSRF et restrictions d’origine. Les jetons ne sont jamais enregistrés dans localStorage ni renvoyés dans les réponses JSON du site. Les fragments de retour de confirmation sont effacés de l’URL avant utilisation ; ils sont échangés avec Supabase à la demande du candidat.

Chaque profil, alerte, candidature et notification est protégé par les politiques RLS de PostgreSQL. Le serveur effectue les opérations courantes avec le jeton du candidat, pas avec la clé administrateur. La clé serveur facultative sert aux statistiques privées et au traitement périodique des alertes.

## Activation, dans cet ordre

1. Dans **Supabase → SQL Editor → New query**, exécuter le contenu de `supabase/migrations/20261118_candidate_accounts.sql`. Cette migration crée des tables supplémentaires et ne remplace aucune offre. Elle peut être réexécutée. Vérifier :

   ```sql
   select public.of_setup_status();
   -- attendu : {"version":1}
   ```

2. Dans **Authentication → URL Configuration**, définir **Site URL** sur `https://alterstage.onrender.com` et autoriser exactement le retour `https://alterstage.onrender.com/compte` dans **Redirect URLs**. Adapter ces deux adresses si l’adresse du site change.

3. Dans **Authentication → Providers → Email**, activer les inscriptions par e-mail et **Confirm email**. Le site ferme les inscriptions si l’autoconfirmation est activée. Les comptes non confirmés ne peuvent pas accéder au suivi.

4. Configurer un expéditeur SMTP autorisé dans Supabase pour les e-mails de confirmation et de récupération. L’expéditeur de test intégré à Supabase a des restrictions d’envoi ; sa présence ne prouve pas que les visiteurs recevront leurs messages. Les modèles par défaut avec retour implicite sont pris en charge ; un modèle avec `#token_hash={{ .TokenHash }}&type=email` (ou `recovery`) est également pris en charge.

5. Dans **Render → Environment**, ajouter `CANDIDATE_ACCOUNTS_ENABLED=true`, puis enregistrer et redéployer. L’URL Supabase et la clé **publique** reçues sont déjà dans `config/candidate-service.json` ; elles peuvent être remplacées par `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY`. Ne jamais mettre une clé secrète dans ce fichier ni dans une variable `VITE_*`.

6. Pour l’actualisation des alertes en arrière-plan et les statistiques privées, ajouter dans Render seulement `SUPABASE_SERVICE_ROLE_KEY` (clé serveur Supabase). Elle donne des droits élevés et ne doit pas être partagée dans le chat. Sans elle, les comptes et le suivi fonctionnent ; les correspondances d’alertes sont recalculées lorsque le candidat ouvre « Nouveautés ».

7. Pour les résumés de nouveautés par e-mail, ajouter dans Render `BREVO_API_KEY`, `MAIL_FROM_EMAIL` et éventuellement `MAIL_FROM_NAME`, avec un expéditeur validé chez Brevo. Ces réglages sont distincts du SMTP de Supabase Auth. Sans eux, les alertes dans le compte fonctionnent ; l’option d’e-mail reste désactivée. L’opt-in est individuel, désactivé par défaut. Un lien signé permet le désabonnement sans connexion, après confirmation à l’écran.

## Si une inscription échoue

Un formulaire affiché ne prouve pas que l’e-mail peut partir : le contrôle initial vérifie le schéma et les réglages Auth, sans envoyer de message. Un échec SMTP identifié dans la réponse Supabase affiche une erreur d’envoi, jamais une confirmation d’envoi réussie.

Dans **Administration → Audience & comptes**, le diagnostic privé présente les 20 derniers échecs depuis le démarrage de l’instance. Il reste consultable sans clé serveur et si la récupération des statistiques échoue. Les catégories distinguent l’envoi d’e-mail, le réseau, les identifiants, la migration et les erreurs serveur non expliquées. Une catégorie d’envoi confirme seulement que Supabase n’a pas pu envoyer le message : elle ne désigne pas à elle seule un champ SMTP incorrect.

Les logs Render comportent aussi des lignes `[Comptes] Échec fournisseur` avec l’heure, l’opération, le statut HTTP et un code de fournisseur reconnu. Aucun corps de réponse, adresse de destinataire, identifiant utilisateur, URL complète, mot de passe ou clé n’y est conservé. Pour une cause détaillée, consulter les **logs Auth dans Supabase** à la même heure. Ne pas copier de clé ou de donnée personnelle dans le chat.

Pour un échec d’envoi, contrôler dans Supabase le serveur `smtp-relay.brevo.com`, le port `587`, l’identifiant SMTP affiché par Brevo, la **clé SMTP** et l’adresse d’expéditeur validée. Le code SMTP `535 5.7.8 Authentication failed` indique un refus d’authentification SMTP : recopier le couple identifiant SMTP / clé SMTP de Brevo, distinct du mot de passe du compte et des clés API. Vérifier également les restrictions d’envoi du compte Brevo. L’envoi d’un message à une adresse que l’exploitant contrôle reste nécessaire pour vérifier la réception réelle.

## E-mails classés comme indésirables

Le [guide de réception des e-mails](EMAIL_DELIVERY.md) distingue le contrôle SPF/DKIM/DMARC du classement en spam et fournit deux modèles transactionnels français à installer dans Supabase. Leur préparation dans le dépôt ne modifie pas les e-mails du projet distant.

## Parcours à vérifier après déploiement

- Créer un compte de test avec une adresse que vous contrôlez ; vérifier la réception du message, la confirmation puis la connexion. Ne pas utiliser une adresse d’un tiers.
- Ouvrir un lien de candidature depuis une offre. Au retour, répondre « Oui, j’ai postulé ». Le clic seul doit rester « À confirmer ».
- Mettre à jour l’état, une note et une date de suivi, puis vérifier leur conservation après reconnexion depuis un autre appareil.
- Avec un second compte de test, vérifier que le premier historique n’est pas visible.
- Créer une alerte ; seules les offres admissibles importées **après** sa création doivent apparaître dans les nouveautés. Une nouvelle consultation de la même offre ne doit pas créer de doublon.
- Tester récupération et changement du mot de passe, export, suppression du compte, puis déconnexion effective.
- Vérifier « Administration → Audience & comptes » : les statistiques y sont privées et agrégées, sans notes ni adresses e-mail des candidats.

Les états sont renseignés par le candidat. Aucun statut RH n’est récupéré automatiquement et aucune relance n’est envoyée à l’employeur. La date de prochaine action est un repère affiché dans le suivi, pas une notification planifiée. Les instantanés de candidature restent disponibles même si l’annonce quitte ensuite le catalogue ; leur présence ne signifie pas que l’offre est toujours ouverte.

Le traitement des alertes tourne toutes les 15 minutes tant que le service Render est actif. Une instance gratuite peut dormir ; aucun horaire d’envoi strict n’est garanti. Les résumés sont limités à un par compte et par jour, avec un verrou et au plus trois tentatives. Une interruption après l’envoi mais avant l’accusé d’enregistrement peut exceptionnellement produire un doublon. Aucun envoi réel n’est considéré validé avant un essai sur l’environnement déployé.

## Mesure de fréquentation et données

Le site compte les vues et les comptes connectés actifs par jour. Un compte est dédupliqué à la journée ; les visites anonymes ne le sont pas. Ces compteurs peuvent inclure des robots ou être perturbés par des appels automatisés. Ils ne représentent pas un nombre exact de personnes. Aucun compte n’est imposé pour consulter les offres.

Les données personnelles sont conservées jusqu’à suppression du compte. L’export comprend le profil, les candidatures, l’historique, les alertes et les notifications, sans jeton ni hachage de mot de passe. La suppression demande une réauthentification par mot de passe et supprime les lignes liées ; les compteurs agrégés non identifiants restent. L’exploitant doit compléter ses informations légales avec son identité, son contact et les détails de ses prestataires et de leur hébergement.

## Validation locale et limites

- `npm run build` : compilation de l’interface.
- `node --test test/candidate-rls.test.js test/candidates.test.js` : véritables tables PostgreSQL via PGlite, migration rejouable, isolation entre comptes, droits anonymes, confirmation explicite, historique, plafond des alertes, verrou d’envoi et suppression. Les échanges Auth sont simulés ; aucun e-mail réel n’est envoyé.
- `npm run test:accounts` : parcours navigateur sur ordinateur et téléphone avec la même base PostgreSQL locale, authentification simulée et données fictives temporaires.
- `npm test` : tests complets du projet.

Ces vérifications locales ne prouvent pas l’application de la migration, le paramétrage SMTP, la délivrabilité des messages ni le déploiement sur Render. L’accès réseau de l’atelier doit autoriser `qyffhxibnvnbvtggjhwl.supabase.co` pour vérifier le projet distant, et `alterstage.onrender.com` pour contrôler le site déployé. Les outils de ce chat n’ont pas de connexion administrateur Supabase et ne peuvent pas exécuter la migration avec la seule clé publique.
