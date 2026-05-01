# 🧪 Tests et Validation - Atlas de la Biodiversité

## 📋 Instructions de Test Complètes

### 🗄️ Étape 1 - Migration Supabase

#### Test 1.1: Application de la migration

```bash
# Appliquer la migration
cd c:\tweesic\inseme
supabase db push
```

**Validation attendue:**

- ✅ Tables créées: `biodiversity_taxa`, `biodiversity_observations`, `biodiversity_areas`,
  `biodiversity_media`, `biodiversity_validation_events`
- ✅ Extension PostGIS activée
- ✅ Index géospatiaux créés
- ✅ RLS policies configurées

#### Test 1.2: Vérification des données de test

```sql
-- Vérifier les données insérées
SELECT COUNT(*) as taxa_count FROM biodiversity_taxa;
SELECT COUNT(*) as observations_count FROM biodiversity_observations;
SELECT scientific_name, vernacular_name FROM biodiversity_taxa;
SELECT scientific_name, observed_at, validation_status FROM biodiversity_observations;
```

**Validation attendue:**

- ✅ Au moins 3 taxons de test (Chêne vert, Hérisson, Mésange)
- ✅ Au moins 1 observation de test (Hérisson)

#### Test 1.3: Test index géospatial

```sql
-- Test performance requête géospatiale
EXPLAIN ANALYZE
SELECT * FROM biodiversity_observations
WHERE ST_Within(
  geom,
  ST_MakeEnvelope(9.0, 42.2, 9.3, 42.4, 4326)
);
```

**Validation attendue:**

- ✅ Utilisation de l'index `biodiversity_observations_geom_idx`
- ✅ Temps d'exécution < 100ms pour petite zone

---

### 🔌 Étape 2 - API Backend

#### Test 2.1: Endpoint GET de base

```bash
# Test simple
curl "http://localhost:8888/api/biodiversity/observations"
```

**Validation attendue:**

- ✅ Status 200
- ✅ Format GeoJSON FeatureCollection
- ✅ Au moins 1 feature (observation de test)

#### Test 2.2: Filtres spatiaux

```bash
# Test bbox
curl "http://localhost:8888/api/biodiversity/observations?bbox=9.0,42.2,9.3,42.4"
```

**Validation attendue:**

- ✅ Filtrage spatial fonctionnel
- ✅ Features dans bbox uniquement

#### Test 2.3: Filtres taxonomiques

```bash
# Test filtre espèce
curl "http://localhost:8888/api/biodiversity/observations?taxon=Erinaceus"
```

**Validation attendue:**

- ✅ Recherche insensible à la casse
- ✅ Résultats pertinents uniquement

#### Test 2.4: Filtres temporels

```bash
# Test plage de dates
curl "http://localhost:8888/api/biodiversity/observations?date_from=2024-01-01&date_to=2024-12-31"

# Test jours récents
curl "http://localhost:8888/api/biodiversity/observations?recent_days=30"
```

**Validation attendue:**

- ✅ Filtrage par plage de dates
- ✅ Filtrage par jours récents

#### Test 2.5: Pagination

```bash
# Test pagination
curl "http://localhost:8888/api/biodiversity/observations?limit=5&offset=0"
curl "http://localhost:8888/api/biodiversity/observations?limit=5&offset=5"
```

**Validation attendue:**

- ✅ `total_count` présent
- ✅ `limit` et `offset` respectés
- ✅ Pas de duplication entre pages

#### Test 2.6: Gestion des erreurs

```bash
# Test bbox invalide
curl "http://localhost:8888/api/biodiversity/observations?bbox=invalid"

# Test date invalide
curl "http://localhost:8888/api/biodiversity/observations?date_from=invalid-date"
```

**Validation attendue:**

- ✅ Status 400 pour paramètres invalides
- ✅ Messages d'erreur clairs

---

### 🗺️ Étape 3 - BiodiversityLayer

#### Test 3.1: Intégration dans CitizenMap

```jsx
// Test dans composant React
import { CitizenMap, BiodiversityLayer } from "@inseme/brique-map";

function TestMap() {
  return (
    <CitizenMap biodiversityFilters={{}}>
      {/* La couche biodiversité devrait apparaître dans le LayersControl */}
    </CitizenMap>
  );
}
```

**Validation attendue:**

- ✅ Couche "Biodiversité" visible dans LayersControl
- ✅ Pas d'erreur console
- ✅ Markers affichés pour observations de test

#### Test 3.2: Filtres dynamiques

```jsx
// Test avec filtres
function TestFilteredMap() {
  const [filters, setFilters] = useState({
    taxon: "Erinaceus",
    validation_status: "confirmed",
  });

  return (
    <CitizenMap biodiversityFilters={filters}>
      {/* Seules les observations pertinentes devraient s'afficher */}
    </CitizenMap>
  );
}
```

**Validation attendue:**

- ✅ Filtrage en temps réel
- ✅ Requêtes API avec bons paramètres
- ✅ Mise à jour UI sans rechargement

#### Test 3.3: État vide

```jsx
// Test avec filtres ne retournant rien
<CitizenMap biodiversityFilters={{taxon: "NonExistentSpecies"}}>
```

**Validation attendue:**

- ✅ Message "Aucune observation trouvée"
- ✅ Pas d'erreur
- ✅ UI cohérente

#### Test 3.4: Performance avec gros volume

```bash
# Simuler gros volume (insérer 1000+ observations)
# Tester performance de rendu
```

**Validation attendue:**

- ✅ Rendu fluide jusqu'à 1000 markers
- ✅ Pagination SWR fonctionnelle
- ✅ Memory usage stable

---

### 🎛️ Étape 4 - BiodiversityFilters

#### Test 4.1: Rendu du composant

```jsx
import { BiodiversityFilters } from "@inseme/brique-map";

function TestFilters() {
  const handleFiltersChange = (filters) => {
    console.log("Filters changed:", filters);
  };

  return <BiodiversityFilters onFiltersChange={handleFiltersChange} />;
}
```

**Validation attendue:**

- ✅ Tous les champs affichés
- ✅ Styles Tailwind appliqués
- ✅ Callback `onFiltersChange` fonctionnel

#### Test 4.2: Interactions utilisateur

- **Test champ espèce:**
  - ✅ Placeholder visible
  - ✅ Saisie texte fonctionnelle
  - ✅ Callback déclenché au changement

- **Test dates:**
  - ✅ Sélecteur date natif
  - ✅ Format YYYY-MM-DD
  - ✅ Validation dates valides

- **Test statut validation:**
  - ✅ Liste déroulante complète
  - ✅ Options correctes
  - ✅ Valeur par défaut vide

- **Test période rapide:**
  - ✅ Options 7/30/90/365 jours
  - ✅ Exclusion mutuelle avec dates personnalisées
  - ✅ Reset des dates personnalisées

#### Test 4.3: Reset filtres

- **Test bouton "Réinitialiser":**
  - ✅ Tous les champs vidés
  - ✅ Callback déclenché avec filtres vides
  - ✅ Compteur filtres actifs mis à jour

#### Test 4.4: Compteur filtres actifs

- **Test affichage compteur:**
  - ✅ Format "X / 5"
  - ✅ Mise à jour en temps réel
  - ✅ Comptage correct des filtres non vides

---

### 📥 Étape 5 - Script Import GBIF

#### Test 5.1: Configuration

```bash
# Vérifier configuration script
node -e "
import CONFIG from './scripts/import_gbif.js';
console.log('CONFIG:', CONFIG);
"
```

**Validation attendue:**

- ✅ Configuration bbox correcte (Corte)
- ✅ Limites respectées (max 1000 observations)
- ✅ Période correcte (dernière année)

#### Test 5.2: Exécution du script

```bash
# Exécuter import
cd c:\tweesic\inseme
node scripts/import_gbif.js
```

**Validation attendue:**

- ✅ Logs de progression affichés
- ✅ Connexion Supabase réussie
- ✅ Import sans erreur

#### Test 5.3: Validation des importés

```sql
-- Vérifier données importées
SELECT
  source,
  COUNT(*) as count,
  MIN(observed_at) as earliest,
  MAX(observed_at) as latest
FROM biodiversity_observations
WHERE source = 'gbif'
GROUP BY source;

-- Vérifier taxons créés
SELECT COUNT(*) as gbif_taxa
FROM biodiversity_taxa
WHERE metadata->>'source' = 'gbif_import';
```

**Validation attendue:**

- ✅ Observations GBIF importées
- ✅ Taxons correspondants créés
- ✅ Métadonnées GBIF présentes

#### Test 5.4: Gestion des erreurs

```bash
# Tester avec bbox invalide (modifier CONFIG temporairement)
# Tester avec identifiants Supabase invalides
```

**Validation attendue:**

- ✅ Messages d'erreur clairs
- ✅ Arrêt propre en cas d'erreur critique
- ✅ Logs conservés

---

### 📝 Étape 6 - Contribution Citoyenne

#### Test 6.1: Endpoint POST valide

```bash
# Test soumission complète
curl -X POST "http://localhost:8888/api/biodiversity/observations" \
  -H "Content-Type: application/json" \
  -d '{
    "scientific_name": "Parus major",
    "vernacular_name": "Mésange charbonnière",
    "lat": 42.3094,
    "lng": 9.149,
    "date": "2024-04-15",
    "count": 2,
    "observer_name": "Test User",
    "notes": "Observation depuis mon jardin",
    "habitat": "Jardin urbain"
  }'
```

**Validation attendue:**

- ✅ Status 201
- ✅ Observation créée avec ID
- ✅ Taxon créé si nécessaire
- ✅ `validation_status = "unverified"`
- ✅ `source = "citizen"`

#### Test 6.2: Validation des champs requis

```bash
# Test sans scientific_name
curl -X POST "http://localhost:8888/api/biodiversity/observations" \
  -H "Content-Type: application/json" \
  -d '{"lat": 42.3094, "lng": 9.149, "date": "2024-04-15"}'
```

**Validation attendue:**

- ✅ Status 400
- ✅ Message d'erreur clair

#### Test 6.3: Validation coordonnées

```bash
# Test coordonnées invalides
curl -X POST "http://localhost:8888/api/biodiversity/observations" \
  -H "Content-Type: application/json" \
  -d '{
    "scientific_name": "Test",
    "lat": 999,
    "lng": 999,
    "date": "2024-04-15"
  }'
```

**Validation attendue:**

- ✅ Status 400
- ✅ Erreur coordonnées hors limites

#### Test 6.4: Validation dates

```bash
# Test date future
curl -X POST "http://localhost:8888/api/biodiversity/observations" \
  -H "Content-Type: application/json" \
  -d '{
    "scientific_name": "Test",
    "lat": 42.3094,
    "lng": 9.149,
    "date": "2030-01-01"
  }'
```

**Validation attendue:**

- ✅ Status 400
- ✅ Erreur date future

---

### ⏱️ Étape 7 - Dimension Temporelle

#### Test 7.1: Filtres jours récents

```bash
# Test recent_days dans API
curl "http://localhost:8888/api/biodiversity/observations?recent_days=7"
```

**Validation attendue:**

- ✅ Observations des 7 derniers jours seulement
- ✅ Date calculée correctement

#### Test 7.2: Intégration UI

```jsx
// Test filtre période rapide
<BiodiversityFilters onFiltersChange={(filters) => console.log(filters)} />
```

**Actions de test:**

- ✅ Sélectionner "Derniers 30 jours"
- ✅ Vérifier `filters.recent_days = "30"`
- ✅ Vérifier `filters.date_from` et `filters.date_to` vidés

#### Test 7.3: Tri par date

```bash
# Vérifier ordre chronologique inverse
curl "http://localhost:8888/api/biodiversity/observations" | \
  jq '.features[] | .properties.observed_at' | head -5
```

**Validation attendue:**

- ✅ Observations les plus récentes en premier

---

## 🚀 Scénarios de Test Intégrés

### Scénario 1: Workflow Complet Utilisateur

1. **Utilisateur ouvre la carte**
   - ✅ Carte affiche zone Corte
   - ✅ Couche biodiversité disponible

2. **Utilisateur active filtre espèce**
   - ✅ Recherche "Hérisson"
   - ✅ Observations filtrées

3. **Utilisateur soumet nouvelle observation**
   - ✅ Formulaire valide
   - ✅ Observation créée
   - ✅ Apparaît sur carte après rafraîchissement

### Scénario 2: Import GBIF + Validation

1. **Administrateur exécute import GBIF**
   - ✅ Script s'exécute sans erreur
   - ✅ 100+ observations importées

2. **Validateur consulte observations**
   - ✅ Filtre `validation_status = "unverified"`
   - ✅ Observations GBIF identifiées

3. **Validateur confirme observation**
   - ✅ Statut passe à "confirmed"
   - ✅ Couleur marker change

### Scénario 3: Performance Volume

1. **Test avec 1000+ observations**
   - ✅ API répond < 2s
   - ✅ Carte reste responsive
   - ✅ Pagination SWR efficace

2. **Test bbox dense**
   - ✅ Requête géospatiale optimisée
   - ✅ Index utilisé
   - ✅ Résultats temps réel

---

## 📊 Checklist de Validation Finale

- [ ] **Database**: Tables créées, index OK, RLS configuré
- [ ] **API GET**: Tous filtres fonctionnels, pagination OK
- [ ] **API POST**: Validation robuste, création OK
- [ ] **Frontend**: Composants intégrés, pas d'erreurs
- [ ] **Filtres**: UI fonctionnelle, callbacks OK
- [ ] **Import GBIF**: Script exécutable, données importées
- [ ] **Performance**: Acceptable jusqu'à 1000 observations
- [ ] **UX**: Messages clairs, états gérés
- [ ] **Sécurité**: RLS respecté, validation input
- [ ] **Logging**: Erreurs tracées, debugging possible

---

## 🐛 Dépannage Commun

### Erreur "Supabase not initialized"

```bash
# Vérifier configuration Supabase
supabase status
supabase db reset
```

### Erreur CORS

```bash
# Vérifier headers dans functions Netlify
# Ajouter Access-Control-Allow-Origin: *
```

### Performance lente

```sql
-- Vérifier utilisation index
EXPLAIN ANALYZE SELECT * FROM biodiversity_observations WHERE bbox_filter;

-- Recréer index si nécessaire
DROP INDEX IF EXISTS biodiversity_observations_geom_idx;
CREATE INDEX biodiversity_observations_geom_idx
ON biodiversity_observations USING gist (geom);
```

### Markers n'apparaissent pas

```javascript
// Vérifier console erreurs
// Vérifier réponse API
// Vérifier coordonnées valides (lat, lng)
```

---

_Document de test créé le 1er mai 2026 - Atlas Biodiversité Inseme_
