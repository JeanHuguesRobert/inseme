# 📍 État des Lieux SIG pour l'Atlas de la Biodiversité

## 🎯 Objectif

Documenter l'existant en matière de Systèmes d'Information Géographique (SIG) dans le projet
Inseme/Cyrnea pour évaluer l'intégration d'un "Atlas de la Biodiversité".

---

## 🗺️ Infrastructure Cartographique Existante

### Stack Technique Principal

- **Framework**: React avec `react-leaflet` (v4.2.1)
- **Librairie cartographique**: Leaflet (v1.9.4)
- **Extensions IGN**: Geoportal Extensions Leaflet (v2.4.3)
- **Gestion des données**: SWR pour le fetching asynchrone
- **Routing**: React Router DOM pour la navigation

### Composants Cartographiques Disponibles

#### 🧭 Carte de Base - `CitizenMap`

```javascript
// Localisation: packages/brique-map/src/components/CitizenMap.jsx
- Coordonnées par défaut: Corte [42.3094, 9.149]
- Zoom configurable via vault/env
- Contrôles intégrés: LayersControl, LocateControl
- Support du scrollWheelZoom
```

#### 🔍 Géocodage et Recherche

- **AddressSearchControl**: Recherche d'adresses via Nominatim (OpenStreetMap)
- **LocationParser**: Parsing multi-format (Google Maps, OSM, Geo URIs, coordonnées DMS)
- **GeoportalControls**: Intégration des services de géocodage IGN

#### 🗂️ Couches de Données Implémentées

1. **EventsLayer** - Événements sociaux avec positionnement
2. **IncidentsLayer** - Signalements citoyens géolocalisés
3. **MunicipalPoiLayer** - Points d'intérêt municipaux (API `/api/municipal/pois`)
4. **MunicipalEventsLayer** - Événements municipaux

#### 🛠️ Contrôles Avancés

- **LayersControl**: Overlay switcher pour les couches
- **LocateControl**: Géolocalisation utilisateur
- **GeoportalControls**: Accès aux fonds IGN (Plan, Orthophotos, Cadastre)
- **SearchEngine**: Moteur de recherche intégré IGN
- **MousePosition**: Affichage coordonnées en temps réel
- **ReverseGeocode**: Clic pour obtenir l'adresse

---

## 📊 Structure des Données Géographiques

### Format de Location Standard

```javascript
location: {
  lat: Number,    // Latitude WGS84
  lng: Number,    // Longitude WGS84
  address?: String, // Adresse formatée
  raw?: Object    // Données brutes du géocodeur
}
```

### Patterns d'Intégration

- **Metadata Pattern**: `item.metadata.location` pour les données existantes
- **Direct Pattern**: `item.location` pour les nouvelles structures
- **API Pattern**: Endpoint GeoJSON `/api/municipal/pois`

---

## 🏗️ Architecture Modulaire

### Package `@inseme/brique-map`

```
src/
├── components/
│   ├── CitizenMap.jsx           # Carte principale
│   ├── AddressSearchControl.jsx # Recherche adresses
│   ├── GeoportalControls.jsx    # Services IGN
│   ├── LocateControl.jsx        # Géolocalisation
│   ├── LocationPicker.jsx       # Sélecteur de position
│   └── layers/                  # Couches thématiques
│       ├── EventsLayer.jsx
│       ├── IncidentsLayer.jsx
│       ├── MunicipalEventsLayer.jsx
│       └── MunicipalPoiLayer.jsx
├── lib/
│   └── locationParser.js        # Parser multi-format
└── pages/
    └── MapPage.jsx              # Page complète
```

---

## 🔌 Intégrations Externes

### Services IGN (Géoportail)

- **Plan IGN**: Fonds cartographiques standards
- **Orthophotos**: Photographies aériennes
- **Cadastre**: Parcelles fiscales (overlay 70% opacity)
- **Géocodage**: Adresse -> coordonnées
- **Géocodage inversé**: Coordonnées -> adresse

### OpenStreetMap/Nominatim

- Recherche d'adresses worldwide
- API gratuite sans clé nécessaire
- Fallback pour les recherches

---

## 💾 Infrastructure de Données

### Base de Données

- **Supabase**: Backend principal
- **Migrations**: Structure en `supabase/migrations/`
- **Patterns**: Metadata JSON pour flexibilité

### APIs Disponibles

- `/api/municipal/pois` - Points d'intérêt (GeoJSON)
- Patterns SWR pour le caching
- Support des formats GeoJSON standards

---

## 🎨 Personnalisation et Thématisation

### Icônes et Markers

- Icônes Leaflet par défaut (fixées via CSS)
- Système de couleur par catégorie dans `MunicipalPoiLayer`
- Extensible vers des icônes SVG personnalisées

### Styles

- TailwindCSS pour l'interface
- Leaflet CSS pour les contrôles
- Geoportal CSS pour les extensions IGN

---

## 🚀 Recommandations pour Atlas Biodiversité

### 1. **Intégration Immédiate Possible**

- Réutiliser `CitizenMap` comme base
- Créer une nouvelle `BiodiversityLayer` sur le pattern existant
- Exploiter les contrôles IGN déjà intégrés

### 2. **Sources de Données Suggérées**

- **GBIF**: Global Biodiversity Information Facility
- **INPN**: Inventaire National du Patrimoine Naturel
- **Observatoires locaux**: Données citoyennes
- **OpenData**: Jeux de données publiques

### 3. **Fonctionnalités à Développer**

- **Heatmaps**: Densité d'espèces/observations
- **Temporal Filters**: Saisonnalité des observations
- **Taxonomic Layers**: Classification par espèces
- **Contribution Mode**: Saisie citoyenne d'observations
- **Export**: Génération de cartes thématiques

### 4. **Extensions Techniques**

- **Clustering**: Leaflet.markercluster pour les points denses
- **Drawing**: Édition de zones d'étude
- **TimeSlider**: Animation temporelle
- **Offline**: Cache PWA pour les zones non couvertes

---

## 📋 Points d'Attention

### Performance

- Gestion du clustering pour les gros jeux de données
- Lazy loading des couches thématiques
- Optimisation des requêtes API

### UX/UI

- Légendes adaptées aux données biodiversité
- Filtres avancés (taxonomie, période, statut)
- Mode contribution avec validation

### Aspects Légaux

- Droits d'utilisation des données sources
- RGPD pour les données contribution citoyenne
- Attribution des sources de données

---

## 🎯 Prochaines Étapes

1. **Analyser les jeux de données** biodiversité disponibles
2. **Définir le schéma de données** pour les observations
3. **Prototyper une BiodiversityLayer** sur la base existante
4. **Intégrer les APIs** externes (GBIF, INPN)
5. **Développer les fonctionnalités** de contribution citoyenne

---

_Document généré le 1er mai 2026 - Contexte SIG projet Inseme/Cyrnea_
