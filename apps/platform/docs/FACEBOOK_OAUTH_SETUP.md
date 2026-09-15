---
title: Facebook OAuth & Supabase setup
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
license: CC BY-SA 4.0
language: en
document_role: archive
document_kind: software-doc
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: unknown
  origin_ref: unknown
  origin_date: '2026-09-15'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
---

# Facebook OAuth & Supabase setup

This document explains how to create a Facebook App, get the App ID and App Secret, and where to put
them so the app's Facebook sign-in works.

1. Create a Facebook App

- Go to https://developers.facebook.com/ and sign in.
- Click "My Apps" → "Create App" → choose "Consumer" (or the appropriate type) → give it a name and
  create.

2. Get App ID & App Secret

- In the app dashboard open **Settings > Basic**.
- Copy the **App ID** and click **Show** on **App Secret** to copy it.

3. Configure OAuth redirect URIs

- In the left sidebar add the product **Facebook Login** (if not already) and open **Facebook
  Login > Settings**.
- In **Valid OAuth Redirect URIs** add the Supabase callback for your project (required):
  - `https://<YOUR_SUPABASE_PROJECT>.supabase.co/auth/v1/callback`

Note: your `SUPABASE_PROJECT` is the subdomain portion of your Supabase URL. Example:

- If `VITE_SUPABASE_URL=https://xyz.supabase.co` then your project id is `xyz` and the callback is:
  - `https://xyz.supabase.co/auth/v1/callback`

Quick code snippet to derive it locally (for reference only — don't display this in the UI):

```javascript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL; // e.g. "https://xyz.supabase.co"
const supabaseProject = supabaseUrl ? supabaseUrl.replace(/^https?:\/\//, "").split(".")[0] : null;
// supabaseProject === 'xyz'
```

Keep this value private when appropriate; you only need it to register redirect URIs on Facebook and
in Supabase settings.

- If you also use the repo's backend OAuth (avatar import via Netlify Functions), add the backend
  callback URIs used by the functions (the backend builds redirect URIs as
  `${APP_BASE_URL}/oauth/facebook/callback`):
  - Production: `https://<YOUR_SITE_DOMAIN>/oauth/facebook/callback`
  - Local dev (Netlify dev): `http://localhost:8888/oauth/facebook/callback`

- Also add your local dev URL if you want Facebook to accept it for testing (optional):
  - `http://localhost:5173/` (or your dev origin)

  Note: Your hosting provider must be configured to return `index.html` for all non-API requests so
  that SPA routes like `/oauth/facebook/callback` are handled client-side. On Netlify, add the
  following in `netlify.toml` or in your redirects config to avoid 404s when Facebook redirects back
  to your site:

  ```
  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
    force = true
  ```

4. Configure Supabase

- Open your Supabase project dashboard → Authentication → Settings → External OAuth Providers.
- Enable **Facebook** and paste the **App ID** and **App Secret** you obtained.
- Save.

5. Environment variables (client & server)

- For the _client app_ (used to decide whether to show the Facebook sign-in button), add to your
  frontend environment file (for Vite use `.env` / `.env.local`):

  VITE_FACEBOOK_APP_ID=your_facebook_app_id

  This is intentionally _only_ to toggle UI visibility; the real OAuth flow uses the App ID/Secret
  configured in Supabase.

- For the _server or deployment settings_ (if you run any backend auth route), store the secret
  securely in your host's environment variables or a `.env` used by the backend:

  FACEBOOK_APP_ID=your_facebook_app_id APP_BASE_URL=https://your-site.netlify.app

  Note: this repo prefers using a server-side `FACEBOOK_TOKEN` (app access token or long-lived
  token) for server operations. If you do still have an app secret available you can set
  `FACEBOOK_CLIENT_SECRET` as a fallback for some server flows, but `FACEBOOK_TOKEN` is the
  recommended and safer choice for server-to-Facebook calls.

  (Exact names depend on your backend code; use the names your backend expects.)

  Additional server env vars used by the repo:
  - `FACEBOOK_TOKEN` (recommended): an app access token or long-lived token used by server functions
    to fetch Facebook profile pictures and oEmbed content without exposing the app secret to
    clients. Server functions prefer `FACEBOOK_TOKEN`. If you do not provide `FACEBOOK_TOKEN` the
    code may fall back to combining `FACEBOOK_APP_ID|FACEBOOK_CLIENT_SECRET`.
  - `SUPABASE_SERVICE_ROLE_KEY` (required for server-side writes): used by Netlify Functions to
    persist provider metadata (for example `metadata.facebookId` and `metadata.avatarUrl`) into the
    `users` table. Keep this value secret; do not expose it to the browser.

6. Redirect URLs and production

- Ensure your production origin is registered where needed:
  - On Facebook App settings (Site URL / Valid OAuth Redirect URIs)
  - In Supabase (the callback provided above)
  - In your deployment provider (Netlify/Vercel) set the environment variables accordingly.

7. Testing locally

- Start your app: `npm run dev` (or your usual command).
- Make sure `.env` contains `VITE_FACEBOOK_APP_ID`.
- Open the auth modal — the Facebook button appears only when `VITE_FACEBOOK_APP_ID` is present.
- Click the button: you should be redirected to Facebook and then back via Supabase's callback URL.

Server-side avatar & fallback (new)

- This repository includes server endpoints that simplify safe access to Facebook profile pictures
  and oEmbed HTML without exposing secrets to the client. In particular:
  - `/api/facebook-avatar` — returns a non-redirecting picture URL for a given Facebook user id
    (`facebookId`) using `FACEBOOK_TOKEN` (preferred) or `FACEBOOK_APP_ID|FACEBOOK_CLIENT_SECRET`.
  - `/api/facebook-oembed` — proxies Facebook oEmbed requests server-side (already present in the
    project) and should be used by client components instead of calling Facebook directly.

- OAuth completion (`/api/oauth-complete`) has been updated so that when a user completes the
  Facebook OAuth avatar flow, the server will persist `metadata.facebookId` and `metadata.avatarUrl`
  into the `users` table using the `SUPABASE_SERVICE_ROLE_KEY`. This lets the frontend display an
  HTTP avatar image directly from user metadata without calling Facebook from the browser.

- Local testing tips:
  - Ensure you set `FACEBOOK_TOKEN` (or `FACEBOOK_APP_ID` + `FACEBOOK_CLIENT_SECRET`) in your local
    environment when running Netlify Dev so the server endpoints work. Example (PowerShell):

    ```powershell
    $env:FACEBOOK_TOKEN='EAF...'
    $env:SUPABASE_URL='https://your.supabase.co'
    $env:SUPABASE_SERVICE_ROLE_KEY='eyJ...'
    npm run dev
    ```

  - For testing the fallback manually, call:

    ```bash
    curl "http://localhost:8888/api/facebook-avatar?facebookId=<facebookId>"
    ```

Metadata-based CSRF protection for custom OAuth flows

- This repo stores a short-lived `state` token in a user's `metadata.oauth.facebook` entry when a
  logged-in user starts the OAuth flow using `/api/oauth-start`.
- The `/api/oauth-start` endpoint requires an Authorization header (Supabase session) and returns an
  `authUrl` that includes the `state` query param. The client should redirect the user to this URL
  for Facebook's OAuth flow.
- When Facebook redirects back to the site, the client must POST `{ provider, code, state }` to
  `/api/oauth-complete` and include the Authorization header (Supabase session). The server
  validates the token, confirms the `state` matches the `metadata.oauth.facebook` value, and checks
  the `expiresAt` (1 hour window). If valid, the server exchanges the `code`, fetches the profile,
  and persists `metadata.facebookId` and `metadata.avatarUrl` on the user record, then removes the
  `oauth` state.
- This flow requires that both `/api/oauth-start` and `/api/oauth-complete` are called while
  authenticated; the repo forbids unauthenticated server-side flows — for signups use
  `supabase.auth.signInWithOAuth` instead.
  - Authorization/consent path: this repo implements a simple consent page at `/oauth/consent`. The
    page explains the provider access and lets a logged-in user initiate the OAuth flow. Example
    preview URL: `http://lepp.fr/oauth/consent`.

Security reminders

- Do not commit `FACEBOOK_CLIENT_SECRET`, `FACEBOOK_TOKEN`, or `SUPABASE_SERVICE_ROLE_KEY` to the
  repository. Rotate any secrets that were previously committed or leaked.
- Add local `.env` files to `.gitignore` and prefer setting environment variables in your deployment
  provider (Netlify, Vercel, etc.).

Notes

- For security, do not commit secrets to the repo. Use deployment provider env vars for production.
- Supabase acts as the OAuth intermediary; you must set the App ID/Secret in Supabase's provider
  settings (step 4).

- CSP: ensure `connect.facebook.net` (and `www.facebook.com` if using widgets) are allowed in your
  Content-Security-Policy. Your `netlify.toml` should allow `*.facebook.com` and
  `connect.facebook.net`. Also add `https://platform-lookaside.fbsbx.com` to `img-src` or
  `default-src` as Facebook avatar images are served from `platform-lookaside.fbsbx.com` (a
  `fbx.com` subdomain), not `facebook.com`.
- Security: never expose your App Secret to the client. The SDK uses the App ID only.

---

## Data deletion callback (obligation de la plateforme Meta)

Meta exige que votre application implémente un "data deletion callback" pour permettre aux
utilisateurs de demander la suppression de leurs données via Facebook. Configurez l'URL de rappel de
suppression de données dans le tableau de bord de l'App (Data Deletion Request Callback URL).

1. Exemple d'URL à définir dans le champ de l'App (Facebook App Settings → Data Deletion Request
   Callback URL):

https://lepp.fr/api/facebook-data-deletion

2. Comportement attendu du callback:

- Recevoir une requête POST contenant `signed_request` (x-www-form-urlencoded).
- Valider la signature with your `FACEBOOK_CLIENT_SECRET` (this callback requires the app secret to
  validate the signed_request; keep it safe). If you have removed `FACEBOOK_CLIENT_SECRET` from your
  environment, re-add it if you plan to support Facebook's data-deletion callback.
- Lancer la suppression des données liées à `user_id` (ou planifier la suppression) côté serveur.
- Répondre immédiatement avec un JSON contenant `url` et `confirmation_code` comme ci‑dessous:

```json
{
  "url": "https://lepp.fr/oauth/facebook/deletion-status?code=abc123",
  "confirmation_code": "abc123"
}
```

3. Exemple d'implémentation (Netlify Function)

- Le projet contient un exemple prêt à l'emploi: `netlify/functions/facebook-data-deletion.js`.
- Il vérifie `signed_request` (HMAC-SHA256) en utilisant `FACEBOOK_CLIENT_SECRET` et renvoie `url` +
  `confirmation_code`.

4. Page de suivi / statut

- Vous devez fournir une page publique à l'URL retournée (`/oauth/facebook/deletion-status`) qui
  affiche le statut de la demande lorsque l'utilisateur saisit ou suit `confirmation_code`.
- Exemple minimal: affichez une page expliquant que la demande est en cours de traitement et montrez
  le `confirmation_code`.

5. Variables d'environnement à définir (Netlify ou autre environnement de fonctions):

- `APP_BASE_URL` : utilisé pour construire `url` de statut (ex: `https://lepp.fr`).

Notes

- Ne lancez pas automatiquement des suppressions irréversibles sans procédure interne de
  vérification/rétention si vos règles RGPD l'exigent.
- Vous pouvez utiliser `SUPABASE_SERVICE_ROLE_KEY` pour effectuer des suppressions côté base de
  données si vous avez une table dédiée et des règles claires. Le code de la fonction contient un
  TODO pour intégrer la logique de suppression.

## Improvements & Hardening

- IDempotency: The repo now implements idempotency for the data deletion and deauthorize callbacks.
  The deletion callback reuses an existing `confirmation_code` when present; the deauthorize
  callback keeps a `facebook_consent.revokedAt` field and will not recreate/overwrite it if already
  set.
- Signature validation: We validate `signed_request` with HMAC-SHA256 (`FACEBOOK_CLIENT_SECRET`). We
  recommend additionally checking `payload.algorithm` equals `HMAC-SHA256` and that the `issued_at`
  timestamp is not too old (e.g. 15–60 minutes maximum allowed age) to prevent replay attacks.
- Deletion workflow: The function returns a `confirmation_code` and the status URL. Implement a
  deletion worker (or manual approval process) to complete the deletion and set
  `status: "completed"`.
- Testing: Add a small developer script to craft signed_request for local testing (using the app
  secret) and test deauthorize / deletion handlers via ngrok.

### Deauthorize callback (revocation of app permissions)

Facebook also sends a deauthorization callback when a user removes your app via their Facebook
settings. Implementing the Deauthorize Callback allows you to detect when the user revokes
permissions and to clear any associated identifiers or tokens.

1. Example URL to configure in the Facebook App dashboard (App Settings → Advanced → Deauthorize
   callback URL):

```text
https://lepp.fr/api/facebook-deauthorize
```

1. Expected behavior of the callback handler:

- Receive a `signed_request` as `application/x-www-form-urlencoded` (or JSON). Validate the
  `signed_request` using your `FACEBOOK_CLIENT_SECRET`.
- Locate the user in your backend (for example by matching `metadata.facebookId`) and remove
  provider identifiers or rotate tokens.
- Optionally set a `facebook_consent.revokedAt` timestamp in the user's metadata and delete
  `facebookId`/`avatarUrl` fields.
- Return 200 (empty or small JSON body is fine).

1. Example: We added a sample Netlify function: `netlify/functions/facebook-deauthorize.js`.

2. Add the callback URL in Facebook Developer console and make sure `FACEBOOK_CLIENT_SECRET` is set
   server-side for signature validation.
