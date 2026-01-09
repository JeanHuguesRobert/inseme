# 🗄️ Schéma SQL — Système Citoyen de Contrôle des Actes Municipaux

## Tables Principales

### `collectivite`

Collectivités territoriales suivies.

```
id uuid PK, nom_officiel text, code_insee varchar(10), type_collectivite,
population int, metadata jsonb, created_at, updated_at
```

### `acte` (versionnée)

Actes municipaux avec versioning strict.

```
id uuid PK, collectivite_id FK, type_acte (DELIBERATION|ARRETE|DECISION|PV|AUTRE),
numero_interne text, numero_actes text, date_acte date, date_seance date,
objet_court text, objet_complet text, organe text, rapporteur text,
exec_declared boolean, exec_declared_date date, exec_confirmed boolean, exec_confirmed_date date,
version int, valid_from timestamp, valid_to timestamp, supersedes_id FK,
metadata jsonb, created_by FK, updated_at
```

### `demande_admin`

Demandes administratives (CRPA, CADA, etc.).

```
id uuid PK, collectivite_id FK, acte_id FK nullable,
type_demande (CRPA|CADA|PRADA|AUTRE), reference_interne text,
destinataire text, objet text, contenu text, date_envoi date,
status (EN_ATTENTE|REPONDU_COMPLET|REPONDU_PARTIEL|REFUS_IMPLICITE|REFUS_EXPLICITE|CLOS),
metadata jsonb, created_by FK, created_at, updated_at
```

### `reponse_admin`

Réponses aux demandes administratives.

```
id uuid PK, demande_id FK, type_reponse (EXPLICITE|IMPLICITE|PARTIELLE),
date_reception date, contenu text, pieces_jointes jsonb,
analyse_conformite text, metadata jsonb, created_at
```

### `teletransmission`

Transmissions préfecture via @CTES.

```
id uuid PK, acte_id FK,
date_declared date, date_confirmed date, numero_ctes text,
statut_technique (EN_ATTENTE|TRANSMIS|VALIDE|REJETE|ANOMALIE),
accuse_reception_url text, metadata jsonb, created_at, updated_at
```

### `deadline_instance`

Échéances juridiques en cours.

```
id uuid PK, deadline_template_id FK, entity_type (ACTE|DEMANDE|RECOURS),
entity_id uuid, trigger_date date, due_date date, days_remaining int,
status (OUVERTE|IMMINENTE|DEPASSEE|RESPECTEE|ANNULEE),
consequence_if_missed text, closed_at timestamp, closed_reason text,
metadata jsonb, created_at, updated_at
```

### `legal_status_instance`

Historique des statuts juridiques.

```
id uuid PK, entity_type text, entity_id uuid,
status_code (NON_TRANSMIS|EN_ATTENTE_CONTROLE|EXECUTOIRE|SUSPENDU|ANNULE|REFUS_IMPLICITE|...),
date_debut date, date_fin date nullable, justification text,
proof_id FK nullable, automated boolean, metadata jsonb, created_at
```

### `recours`

Recours administratifs et contentieux.

```
id uuid PK, collectivite_id FK, acte_id FK nullable, demande_id FK nullable,
type (CADA|GRACIEUX|HIERARCHIQUE|TA|CAA|CE),
status (EN_PREPARATION|ENVOYE|EN_COURS|INSTRUCTION|AVIS_RENDU|JUGEMENT_RENDU|CLOS),
issue (FAVORABLE|DEFAVORABLE|MIXTE|SANS_SUITE|DESISTEMENT) nullable,
date_depot date, date_decision date, reference_juridiction text,
objet text, conclusions text, metadata jsonb, created_at, updated_at
```

### `proof`

Preuves et pièces justificatives.

```
id uuid PK, type_proof (SCREENSHOT|PDF|EMAIL|ACCUSE|AR|AUTRE),
titre text, description text, source_org (MAIRIE|PREFECTURE|CADA|TA|AUTRE),
date_capture date, url_originale text, storage_path text, hash_sha256 text,
force_probante (FAIBLE|MOYENNE|FORTE), verified_by_human boolean,
verified_by FK nullable, verified_at timestamp, metadata jsonb, created_at
```

## Vues Synthétiques

### `v_actes_synthetiques` ⭐

Vue complète des actes avec statut juridique, transmission, deadlines.

```sql
SELECT id, collectivite_nom, type_acte, numero_interne, date_acte,
       objet_court, objet_complet, statut_juridique,
       transmission_confirmed, numero_ctes,
       nb_deadlines_depassees, nb_demandes, nb_preuves,
       synthetic_text -- Texte RAG pré-formaté
FROM v_actes_synthetiques
```

### `v_stats_transmission`

Statistiques de transmission par collectivité.

```sql
SELECT collectivite, total_actes, transmis_confirmes,
       taux_transmission_confirmee, delai_moyen_transmission_jours
FROM v_stats_transmission
```

### `v_stats_crpa`

Statistiques CRPA par collectivité.

```sql
SELECT collectivite, total_demandes, en_attente,
       repondu_complet, refus_implicite, taux_reponse
FROM v_stats_crpa
```

### `v_transparence_score` ⭐

Score de transparence composite.

```sql
SELECT collectivite, score_transmission, score_reponse_crpa,
       score_non_silence, score_global, total_actes, total_demandes
FROM v_transparence_score
```

### `v_deadlines_overdue`

Échéances dépassées avec conséquences.

```sql
SELECT entity_type, entity_id, label_fr, due_date,
       days_remaining, consequence_if_missed
FROM v_deadlines_overdue
```

### `v_deadlines_upcoming`

Échéances à venir (7 jours).

```sql
SELECT entity_type, entity_id, label_fr, due_date, days_remaining
FROM v_deadlines_upcoming
```

## Requêtes Types

### Compter les actes non transmis

```sql
SELECT COUNT(*) FROM v_actes_synthetiques
WHERE transmission_confirmed IS NULL
```

### Délibérations avec délais dépassés

```sql
SELECT numero_interne, objet_court, nb_deadlines_depassees
FROM v_actes_synthetiques
WHERE type_acte = 'DELIBERATION' AND nb_deadlines_depassees > 0
```

### Demandes CRPA en silence administratif

```sql
SELECT reference_interne, objet, date_envoi, status
FROM demande_admin
WHERE status = 'REFUS_IMPLICITE'
ORDER BY date_envoi DESC
```

### Score de transparence avec évolution

```sql
SELECT snapshot_date, score_transparence, taux_transmission, taux_reponse
FROM civic_stats_snapshot
WHERE collectivite_id = 'UUID'
ORDER BY snapshot_date DESC LIMIT 6
```
