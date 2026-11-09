# JHN COP — page de confirmation authentifiée (source, non déployée)

La route React `/cop/consent/:challengeId` dans `src/App.jsx` affiche
`CopPrincipalConsentPage.jsx`. Elle réutilise `useSupabase()` et le composant
`AuthModal` déjà installés. Les champs du mandat (identifiant, version,
motif, actions autorisées et interdites, date d'expiration, SHA-256) sont
présentés avant les boutons **Confirmer** et **Refuser**.

Le navigateur appelle uniquement son origine courante :
`GET /api/cop/principal-consent/<challenge_id>` et
`POST /api/cop/principal-consent/<challenge_id>`, avec le bearer Supabase
provenant de sa session. Le corps du POST contient seulement
`{payload_hash,decision}`. Aucun secret Vault, aucune clé de service et
aucune valeur de mandat n'est créée dans le navigateur.

**État : source compilée, non publiée sur le site.** La route HTTP n'est
PAS encore montée en production. En l'absence du backend canonique,
la page doit afficher une erreur plutôt qu'une approbation de substitution.
Le handler compatible est développé dans Cogentia :
`scripts/lib/jhn-consent-http-handler.js`, à monter dans un service
**issuer** de confiance, à origine HTTPS fixe, avec accès exclusif au
journal COP canonique et à Supabase Auth (`getUser`).

La MCP App `cogentia_cop_consent_review` reste une **interface d'intention**,
non un mécanisme de signature. Le serveur de confiance doit émettre une
proposition précise à durée limitée depuis son propre journal COP et ne
transmettre qu'un `challengeId` opaque à cette page. Après confirmation,
un autre contrôle COP décide éventuellement de la consommation de la preuve
et de l'amendement, avec version, révocation, budget et effets séparés.

Vérification de compilation effectuée localement depuis le dépôt Inseme :
`pnpm run compile:briques` puis `pnpm exec vite build --outDir
/tmp/inseme-jhn-consent-verify --emptyOutDir`. Compilation réussie.
Les modifications auxiliaires aux fichiers de registres générés ont été
restaurées ; elles n'appartiennent pas à cette livraison.
