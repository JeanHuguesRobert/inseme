# 🚀 Guide de Démarrage - Atlas de la Biodiversité

## 📋 Prérequis

- Node.js 18+
- Supabase CLI installé
- Accès à la base de données Inseme/Cyrnea
- Droits d'administration sur le projet

---

## ⚡ Démarrage Rapide (15 minutes)

### 1️⃣ Appliquer la migration

```bash
cd c:\tweesic\inseme
supabase db push
```

### 2️⃣ Vérifier l'installation

```bash
# Vérifier les tables
supabase db shell --query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'biodiversity_%';"
```

### 3️⃣ Démarrer le développement

```bash
npm run dev
```

### 4️⃣ Tester l'API

```bash
curl "http://localhost:8888/api/biodiversity/observations"
```

---

## 🗺️ Intégration dans une Page

### Exemple minimal

```jsx
import React, { useState } from "react";
import { CitizenMap, BiodiversityLayer, BiodiversityFilters } from "@inseme/brique-map";

export default function BiodiversityPage() {
  const [filters, setFilters] = useState({});

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  return (
    <div className="h-screen flex">
      {/* Filtres latéraux */}
      <div className="w-80 p-4 bg-gray-50">
        <h2 className="text-xl font-bold mb-4">Atlas de la Biodiversité</h2>
        <BiodiversityFilters onFiltersChange={handleFiltersChange} />
      </div>

      {/* Carte */}
      <div className="flex-1">
        <CitizenMap biodiversityFilters={filters} />
      </div>
    </div>
  );
}
```

---

## 📥 Importer les Données GBIF

### Lancer l'import

```bash
cd c:\tweesic\inseme
node scripts/import_gbif.js
```

### Personnaliser la zone

```javascript
// Dans scripts/import_gbif.js
const CONFIG = {
  bbox: {
    minLng: 8.5, // Ouest Corse
    minLat: 41.3, // Sud Corse
    maxLng: 9.6, // Est Corse
    maxLat: 43.0, // Nord Corse
  },
  maxObservations: 5000, // Plus de données
  dateFrom: "2023-01-01", // Depuis 2023
};
```

---

## 🧪 Tester la Contribution Citoyenne

### Via curl

```bash
curl -X POST "http://localhost:8888/api/biodiversity/observations" \
  -H "Content-Type: application/json" \
  -d '{
    "scientific_name": "Parus major",
    "vernacular_name": "Mésange charbonnière",
    "lat": 42.3094,
    "lng": 9.149,
    "date": "2024-04-15",
    "observer_name": "Test User"
  }'
```

### Via JavaScript

```javascript
const observation = {
  scientific_name: "Parus major",
  vernacular_name: "Mésange charbonnière",
  lat: 42.3094,
  lng: 9.149,
  date: "2024-04-15",
  observer_name: "Citoyen Test",
};

fetch("/api/biodiversity/observations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(observation),
})
  .then((response) => response.json())
  .then((data) => console.log("Observation créée:", data));
```

---

## 🔍 Requêtes API Utiles

### Observations par zone

```bash
# Zone de Corte
curl "http://localhost:8888/api/biodiversity/observations?bbox=9.0,42.2,9.3,42.4"
```

### Observations récentes

```bash
# Derniers 30 jours
curl "http://localhost:8888/api/biodiversity/observations?recent_days=30"
```

### Par espèce

```bash
# Hérissons
curl "http://localhost:8888/api/biodiversity/observations?taxon=Erinaceus"
```

### Observations validées

```bash
curl "http://localhost:8888/api/biodiversity/observations?validation_status=confirmed"
```

---

## 📊 Monitoring et Statistiques

### Nombre d'observations par source

```sql
SELECT
  source,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
FROM biodiversity_observations
GROUP BY source
ORDER BY count DESC;
```

### Observations par mois

```sql
SELECT
  DATE_TRUNC('month', observed_at) as month,
  COUNT(*) as observations_count
FROM biodiversity_observations
WHERE observed_at >= '2024-01-01'
GROUP BY month
ORDER BY month;
```

### Top 10 espèces observées

```sql
SELECT
  scientific_name,
  vernacular_name,
  COUNT(*) as observation_count
FROM biodiversity_observations
WHERE scientific_name IS NOT NULL
GROUP BY scientific_name, vernacular_name
ORDER BY observation_count DESC
LIMIT 10;
```

---

## 🎨 Personnalisation

### Icônes personnalisées

```jsx
// Dans BiodiversityLayer.jsx
const getBiodiversityIcon = (observation) => {
  const { properties } = observation;

  // Icônes par groupe taxonomique
  if (properties.taxonomy?.class_name === "Aves") {
    return birdIcon;
  }
  if (properties.taxonomy?.class_name === "Mammalia") {
    return mammalIcon;
  }
  // etc.
};
```

### Couleurs par statut

```css
/* Styles personnalisés */
.biodiversity-marker.verified {
  background-color: #10b981;
}
.biodiversity-marker.unverified {
  background-color: #6b7280;
}
.biodiversity-marker.rejected {
  background-color: #ef4444;
}
```

---

## 🔧 Maintenance

### Nettoyer les anciennes observations

```sql
-- Supprimer observations > 5 ans et non validées
DELETE FROM biodiversity_observations
WHERE observed_at < NOW() - INTERVAL '5 years'
AND validation_status = 'unverified';
```

### Optimiser les index

```sql
-- Recréer index géospatial
REINDEX INDEX biodiversity_observations_geom_idx;

-- Mettre à jour les statistiques
ANALYZE biodiversity_observations;
```

### Backup des données

```bash
# Exporter les observations
supabase db dump --data-only --table=biodiversity_observations > biodiversity_backup.sql
```

---

## 🐛 Problèmes Courants

### Markers n'apparaissent pas

1. Vérifier la console pour erreurs
2. Vérifier que la couche est activée dans LayersControl
3. Vérifier les filtres appliqués

### API retourne vide

1. Vérifier qu'il y a des données dans la table
2. Vérifier les filtres (bbox, dates)
3. Vérifier les permissions RLS

### Import GBIF échoue

1. Vérifier la connexion Supabase
2. Vérifier les identifiants dans `.env`
3. Vérifier l'accès internet (API GBIF)

---

## 📚 Ressources

- **Documentation Supabase**: https://supabase.com/docs
- **API GBIF**: https://www.gbif.org/developer/summary
- **Leaflet React**: https://react-leaflet.js.org/
- **PostGIS**: https://postgis.net/docs/

---

## 🆘 Support

En cas de problème:

1. Consulter les logs dans `./logs/`
2. Vérifier la documentation de test: `docs/biodiversite-tests-validation.md`
3. Créer une issue avec les détails de l'erreur

---

_Guide de démarrage créé le 1er mai 2026 - Atlas Biodiversité Inseme_
