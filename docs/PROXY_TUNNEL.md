# Architecture Proxy & Tunnel

Ce document décrit l'architecture réseau mise en place pour gérer le développement local et l'accès
aux instances (Supabase, Netlify) via un tunnel sécurisé.

## 🎯 Problématique

L'application Inseme/Cyrnea utilise une architecture hybride :

1.  **Deno (Edge Functions)** : Gère nativement les proxys via les variables d'environnement
    (`HTTP_PROXY`, `HTTPS_PROXY`).
2.  **Node.js (Netlify Functions & Scripts locaux)** : Ne gère **pas** nativement les proxys globaux
    pour `fetch`.
3.  **Tunnel (Cloudflare/Ngrok)** : Expose l'environnement local mais ne doit jamais se "proxyer
    lui-même" (risque de boucle infinie).

## 🛡️ Solution Implémentée

### 1. Unified Proxy Logic (`@inseme/cop-host`)

Une logique centralisée a été créée dans le package `cop-host` pour aligner le comportement de
Node.js sur celui de Deno.

- **Fichier** : `packages/cop-host/src/utils/node-proxy.js`
- **Fonctionnement** :
  - Détecte l'environnement (Node, Netlify, Deno).
  - Lit les variables `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` (supporte `.env`, `Netlify.env`,
    `Deno.env`).
  - Configure `undici` (le moteur `fetch` de Node) avec `EnvHttpProxyAgent`.
  - **Résultat** : Tout appel `fetch()` dans Node respecte désormais le proxy, exactement comme en
    Deno.

### 2. Protection du Tunnel (Anti-Loop)

Le script de tunnel (`apps/platform/scripts/tunnel.js`) diffuse les variables de proxy aux autres
processus (via `.env`), mais doit impérativement les ignorer pour sa propre connexion sortante.

- **Mécanisme** : Au démarrage, le tunnel "sanitize" son propre environnement en supprimant
  `process.env.HTTP_PROXY` et `process.env.HTTPS_PROXY`.
- **Sécurité** : Cela empêche le tunnel de tenter de router son trafic à travers lui-même (ce qui
  causerait un crash ou un timeout).

### 3. Usage & Intégration

#### Dans les scripts Node.js locaux

Il suffit d'importer le helper au tout début du script :

```javascript
import "./setup-proxy.js"; // Wrapper vers @inseme/cop-host
// ou
import "@inseme/cop-host/utils/node-proxy.js";
```

#### Dans les Netlify Functions (Node)

Le pont est fait automatiquement via `instance-config-bridge.js` :

```javascript
import "@inseme/cop-host/utils/node-proxy.js";
```

#### Dans Deno (Edge Functions)

Aucune action requise. Deno utilise nativement les variables définies dans `.env` (générées par le
tunnel).

## 📱 Outils Développeur

### Inspecteur & QR Code

Le tunnel inclut un inspecteur de trafic accessible localement.

- **Interface** : `http://localhost:8889/__inspector/`
- **QR Code** : Permet de flasher l'URL du tunnel (ex: `https://cyrnea.trycloudflare.com`) pour
  tester facilement sur mobile ("Onboarding").
- **Génération** :
  - **Console** : Affiché dans le terminal au lancement.
  - **UI** : Disponible via un bouton dans l'inspecteur web.

## 📂 Fichiers Clés

| Fichier                                     | Rôle                                                            |
| ------------------------------------------- | --------------------------------------------------------------- |
| `packages/cop-host/src/utils/node-proxy.js` | Logique centrale du proxy Node.js                               |
| `apps/platform/scripts/tunnel.js`           | Script principal du tunnel (avec protection anti-loop)          |
| `scripts/setup-proxy.js`                    | Point d'entrée pour les scripts locaux (backward compatibility) |
| `apps/platform/scripts/inspector.js`        | UI de l'inspecteur (incluant le QR code)                        |
