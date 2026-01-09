JS only, ES6, concise, expert, reuse, honest

## Monorepo Workflow
- **Netlify Dev**: Toujours lancer `netlify dev` depuis le répertoire spécifique de l'application (ex: `apps/cyrnea`) et non depuis la racine du monorepo.
- **Paths in netlify.toml**: Les chemins vers les fonctions doivent être définis depuis la racine du monorepo (ex: `apps/cyrnea/netlify/functions`).
