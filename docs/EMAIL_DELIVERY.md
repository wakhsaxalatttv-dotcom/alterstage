# Réception des e-mails de compte

Recevoir un message dans les indésirables confirme sa livraison à la boîte, pas une panne SMTP. L’acceptation SMTP, l’authentification de l’expéditeur et le classement en boîte principale sont trois contrôles distincts. Aucun changement de modèle ou de fournisseur ne garantit à lui seul ce classement.

## Diagnostiquer le message réellement reçu

Dans Gmail, ouvrir le message puis le menu ⋮ à côté de Répondre → **Afficher l’original**. Relever les résultats **SPF**, **DKIM** et **DMARC**, ainsi que les domaines concernés. Ne pas partager le lien de confirmation, le message complet, les destinataires ou les jetons.

- En cas d’échec d’authentification, contrôler l’expéditeur réel et l’authentification du domaine dans Brevo avant de modifier le contenu du message.
- Si SPF, DKIM et DMARC sont tous validés, le spam peut encore dépendre de la réputation du domaine ou de l’IP, des liens, du contenu et des signaux propres au destinataire. Ne pas attribuer automatiquement le problème à une clé SMTP ou à l’adresse Gmail.
- Une adresse `@gmail.com` ne donne aucun accès aux DNS de `gmail.com`. Il n’est pas possible d’y ajouter soi-même les enregistrements Brevo. Pour une adresse sur un domaine que l’exploitant possède, utiliser **Brevo → Expéditeurs, domaine, IP → Domaines** et publier exactement les valeurs DNS demandées. Ne pas inventer de valeurs DKIM/DMARC, supprimer des enregistrements existants ni créer plusieurs enregistrements SPF.
- La validation d’une adresse d’expéditeur dans Brevo et l’authentification de son domaine sont des étapes différentes. Vérifier l’adresse réellement affichée dans le message reçu, y compris si le fournisseur réécrit l’expéditeur.

Marquer un message légitime comme « Non spam » et ajouter l’expéditeur aux contacts aide pour la boîte concernée ; cela ne corrige pas automatiquement la réception pour tous les visiteurs. Ne pas multiplier les demandes de confirmation pour tenter d’améliorer la réputation.

## Modèles transactionnels prêts à installer

Les fichiers ci-dessous sont des modèles à copier dans le tableau de bord **Supabase → Authentication → Emails → Templates**. Le dépôt et un redéploiement Render ne changent pas les modèles hébergés chez Supabase.

| Modèle Supabase | Objet                                              | Fichier                                      |
| --------------- | -------------------------------------------------- | -------------------------------------------- |
| Confirm signup  | Confirmez votre adresse e-mail — Offres Fraîches   | `supabase/email-templates/confirmation.html` |
| Reset password  | Réinitialisez votre mot de passe — Offres Fraîches | `supabase/email-templates/recovery.html`     |

Copier tout le HTML dans le corps du modèle correspondant, renseigner son objet et enregistrer. Conserver **exactement** la variable `{{ .ConfirmationURL }}` : Supabase fournit le lien signé propre à chaque demande. Ne pas remplacer cette variable par le lien d’un ancien message. Ces modèles conservent le parcours de confirmation et de récupération déjà implémenté dans l’application.

Ils utilisent un seul lien d’action, des styles intégrés, des polices système et aucun script, image externe, pixel de suivi ou texte promotionnel. Ils restent lisibles sur téléphone. Ils ne changent pas l’authentification SPF/DKIM/DMARC. Si le suivi des clics Brevo est activé, vérifier qu’il ne réécrit pas le lien de confirmation Supabase ; un lien de sécurité ne doit pas être consommé ou altéré par un outil de suivi.

Après installation, effectuer un essai à une adresse contrôlée, vérifier les résultats d’authentification dans le nouveau message, puis tester le lien et la connexion. La prévisualisation locale ne prouve ni l’installation dans Supabase, ni la réception en boîte principale. La réception chez plusieurs fournisseurs doit être vérifiée séparément avant de conclure.
