# Ophélia v3.0 : Documentation de l'Agente Inseme

Ophélia est une intelligence artificielle agentique intégrée à Inseme pour agir comme médiatrice ("Monsieur Loyal") et participante active lors des assemblées.

## 1. Architecture
Ophélia repose sur une architecture **stateless et événementielle** utilisant les Netlify Edge Functions :
- **Déclenchement** : Elle est "réveillée" par le hook frontend `useInseme` lors d'événements clés (nouveaux messages, minuteurs).
- **Contexte** : À chaque appel, elle reçoit un instantané complet de la salle (historique des messages, proposition actuelle, file d'attente des orateurs).
- **Actions** : Elle utilise le "Tool Calling" d'OpenAI pour agir sur l'état de la salle.

## 2. Configuration de la Personnalité
Vous pouvez modifier son comportement sans toucher au code en éditant le fichier :
`public/prompts/inseme.md`

Ce fichier définit sa mission, son ton et ses priorités (ex: favoriser le consensus, limiter le temps de parole).

## 3. Configuration de la Voix (TTS)
La voix d'Ophélia est définie par le paramètre `VOICE` tout au début du fichier `public/prompts/inseme.md`.

**Exemple :**
```markdown
VOICE: shimmer
# Mission d'Ophélia...
```

**Options disponibles :**
- `nova` : Énergique et professionnelle (Haut-parleur par défaut).
- `shimmer` : Douce et posée.
- `alloy` : Neutre et équilibrée.
- `echo` : Masculine et calme.
- `fable` : Narrative et dynamique.
- `onyx` : Masculine et autoritaire.

## 4. Configuration Multi-Provider (LLM & TTS)
Ophélia est compatible avec tout fournisseur respectant le standard OpenAI (Groq, Mistral, Anthropic via proxy, Ollama, etc.). La configuration peut se faire à deux niveaux :

### A. Configuration via le Hook (Code)
Lors de l'instanciation de `useInseme`, vous pouvez passer un objet `ophelia` dans la configuration :

```javascript
const { ... } = useInseme(roomName, user, supabase, {
    ophelia: {
        api_url: "https://api.groq.com/openai/v1/chat/completions", // Endpoint LLM
        model: "llama-3.3-70b-versatile",                         // Modèle LLM
        api_key: "gsk_...",                                       // Clé API (optionnelle si env var définie)
        tts_url: "https://api.openai.com/v1/audio/speech",        // Endpoint TTS (optionnel)
        tts_model: "tts-1"                                        // Modèle TTS (optionnel)
    }
});
```

### B. Configuration via Room Settings (SaaS/DB)
Si vous utilisez la table `inseme_rooms`, les paramètres dans `settings.ophelia` priment sur les défauts.

---

## 5. Capacités et Outils
Ophélia dispose d'une palette d'outils pour animer l'assemblée :
- `send_message` : Participer au chat textuel.
- `speak` : Intervenir oralement via synthèse vocale (TTS).
- `set_proposition` : Reformuler et figer une proposition pour le vote suite à un consensus.
- `manage_speech_queue` : Gérer la file d'attente des orateurs (inviter/retirer).
- `consult_archives` : Rechercher des faits dans l'historique exact (Qui a dit quoi ?).

## 6. Médiation et Équité de Parole
Ophélia reçoit désormais des statistiques en temps réel sur le temps de parole des participants :
- **Capture** : Le frontend mesure la durée réelle de chaque intervention vocale.
- **Analyse** : Ophélia reçoit un récapitulatif (ex: `Alice: 45s, Bob: 120s`).
- **Médiation** : Elle est instruite pour identifier les monopoles de parole et solliciter les participants les plus discrets afin de garantir un débat équilibré.

---
*Note technique : Par défaut, Ophélia utilise `gpt-4o` pour sa réflexion et `tts-1` pour sa voix via l'API OpenAI officielle.*
