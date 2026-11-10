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

## Staging réseau complémentaire (2026-11-09)

Le profil JHN Netlify référence désormais l'Edge Function
`principal-consent-proxy.js`, générée depuis le fichier source
`apps/platform/netlify/edge-functions/principal-consent-proxy.js`. Le navigateur continue à requêter son origine
canonique `https://jhn.baronsmariani.org`. L'Edge Function ne conserve
aucune clé d'autorité et relaie uniquement GET/POST avec Bearer Supabase vers
le service loopback de Fracta2, via le matcher Caddy limité à cette route.
Aucun émetteur mandat ne vit dans Netlify. Tant que le service Fracta2 ou
son routage n'est pas installé, les erreurs en amont sont renvoyées comme
`503 canonical_consent_issuer_unavailable`, et jamais comme un succès.
Les actions de consentement restent désactivées par défaut pendant le
staging. Voir Cogentia `docs/cop-consent-production-staging-2026-11-09.md`.

La compilation de production JHN a réussi avec la génération par
`compile:briques:jhn`, et `netlify.toml` déclenche désormais explicitement
cette génération avant la construction Vite. Les trois tests du relais
sont verts, y compris son refus du HTML d'authentification Caddy.

## 2026-11-10 — Ratification réelle sans extension

La page détecte `cop.mandate-ratification.proposal/v1` et affiche la version
courante, le périmètre du mandat déjà existant et l'avertissement qu'il
n'est ni modifié ni élargi. Le bouton est « Ratifier le mandat existant ».
Le backend Cogentia interdit `apply()` sur ce type, même après une décision
favorable authentifiée ; seule une trace de validation peut être enregistrée.
La première demande est limitée à `mandate:jhn:john-root` et se déclenche
uniquement depuis une session SSH du propriétaire sur Fracta2.
