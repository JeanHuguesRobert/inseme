# Inseme v3.0 : Guide de Packaging & Réutilisation

Inseme a été conçu pour être facilement intégré dans d'autres applications React (ex: Kudocracy, LePP.fr). Vous pouvez utiliser le composant complet `<InsemeRoom />` ou construire votre propre interface en utilisant le `InsemeProvider`.

## 1. Intégration Rapide (`InsemeRoom`)
Le moyen le plus simple d'ajouter une salle d'assemblée complète à votre projet.

```jsx
import { InsemeRoom } from './package/inseme';
import { supabase } from './lib/supabase';

function MyMiniApp() {
  const user = { id: '123', user_metadata: { full_name: 'Alice' } };

  return (
    <InsemeRoom 
      roomName="Agora-2024"
      user={user}
      supabase={supabase}
      config={{
        promptUrl: '/prompts/inseme.md',
        opheliaUrl: '/api/ophelia'
      }}
    />
  );
}
```

## 2. Personnalisation par "Slots"
Vous pouvez remplacer n'importe quel composant par défaut par le vôtre tout en gardant la logique de synchronisation.

```jsx
<InsemeRoom 
  roomName="Agora-2024"
  slots={{
    Chat: MyCustomChat, // Votre propre composant de chat
    Results: MinimalResults // Votre propre visualisation des votes
  }}
/>
```

## 3. Utilisation "Headless" (`InsemeProvider`)
Si vous voulez réutiliser uniquement la logique (messages, votes, médiation d'Ophélia) sans aucune interface Inseme.

```jsx
import { InsemeProvider, useInsemeContext } from './package/inseme';

function MyApp() {
  return (
    <InsemeProvider supabase={myClient} roomName="Test">
      <CustomUI />
    </InsemeProvider>
  );
}

function CustomUI() {
  const { roomData, castVote } = useInsemeContext();
  
  return (
    <div>
      <h1>Proposition : {roomData.proposition}</h1>
      <button onClick={() => castVote('ok')}>Voter OK</button>
    </div>
  );
}
```

## 4. Propriétés (API)
| Prop | Type | Description |
| :--- | :--- | :--- |
| `roomName` | `string` | Identifiant unique de la salle. |
| `user` | `object` | Objet utilisateur Supabase. |
| `supabase` | `object` | Instance du client Supabase. |
| `config` | `object` | Configuration Jitsi, Ophélia, etc. |
| `config.profileTable` | `string` | Nom de la table de profils (défaut: `users`). |
| `slots` | `object` | Overrides de composants UI. |

## 5. Adaptation du Schéma Database

Inseme s'adapte à votre infrastructure existante. Par défaut, il s'attend à ce que les profils utilisateurs soient dans une table nommée `users`. Si votre application utilise une table `profiles`, configurez-la ainsi :

```jsx
<InsemeRoom 
  roomName="MaSalle"
  config={{
    profileTable: 'profiles'
  }}
/>
```

### Identité d'Ophélia (AI)
Pour qu'Ophélia puisse exister et être tracée dans vos archives, vous devez insérer son identité dans votre table de profils. Voici un exemple de migration SQL :

```sql
-- 1. Autoriser le rôle 'ai' si vous avez une contrainte de rôle
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role = ANY (ARRAY['user', 'moderator', 'admin', 'ai']));

-- 2. Insérer l'identité fixe d'Ophélia
INSERT INTO public.profiles (id, display_name, role, avatar_url)
VALUES (
    '00000000-0000-0000-0000-000000000001', 
    'Ophélia', 
    'ai', 
    'https://api.dicebear.com/7.x/bottts/svg?seed=Ophelia'
)
ON CONFLICT (id) DO NOTHING;
```

## 6. Dépendances de Style
Les composants Inseme utilisent **Tailwind CSS**. Assurez-vous que votre projet hôte configure Tailwind pour scanner le répertoire des composants Inseme :

```javascript
// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/package/inseme/**/*.{js,jsx}", // Important !
  ],
  // ...
}
```
