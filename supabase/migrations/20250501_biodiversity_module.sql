-- Biodiversity module for Inseme / Cyrnea
-- Supabase / PostgreSQL
-- Migration: 20250501_biodiversity_module.sql

create extension if not exists postgis;

-- 1. Species / taxonomic reference cache
create table if not exists biodiversity_taxa (
  id uuid primary key default gen_random_uuid(),

  scientific_name text not null,
  vernacular_name text,
  taxon_rank text,
  kingdom text,
  phylum text,
  class_name text,
  order_name text,
  family_name text,
  genus text,

  gbif_taxon_key bigint,
  inpn_cd_nom bigint,

  protected_status text,
  invasive_status text,
  conservation_status text,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (scientific_name)
);

create index if not exists biodiversity_taxa_scientific_name_idx
  on biodiversity_taxa using gin (to_tsvector('simple', scientific_name));

create index if not exists biodiversity_taxa_vernacular_name_idx
  on biodiversity_taxa using gin (to_tsvector('french', coalesce(vernacular_name, '')));


-- 2. Biodiversity observations
create table if not exists biodiversity_observations (
  id uuid primary key default gen_random_uuid(),

  taxon_id uuid references biodiversity_taxa(id) on delete set null,

  scientific_name text,
  vernacular_name text,

  observed_at timestamptz not null,
  observed_date date generated always as (observed_at::date) stored,

  observer_name text,
  observer_id uuid,

  source text not null default 'citizen'
    check (source in ('citizen', 'gbif', 'inpn', 'manual_import', 'sensor', 'partner')),

  validation_status text not null default 'unverified'
    check (validation_status in ('unverified', 'probable', 'confirmed', 'rejected')),

  certainty text default 'unknown'
    check (certainty in ('unknown', 'low', 'medium', 'high')),

  count integer check (count is null or count >= 0),

  life_stage text,
  sex text,
  behavior text,
  habitat text,

  latitude double precision not null,
  longitude double precision not null,

  geom geography(point, 4326)
    generated always as (
      st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
    ) stored,

  location jsonb default '{}'::jsonb,
  media jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists biodiversity_observations_geom_idx
  on biodiversity_observations using gist (geom);

create index if not exists biodiversity_observations_taxon_idx
  on biodiversity_observations (taxon_id);

create index if not exists biodiversity_observations_observed_at_idx
  on biodiversity_observations (observed_at);

create index if not exists biodiversity_observations_source_idx
  on biodiversity_observations (source);

create index if not exists biodiversity_observations_validation_idx
  on biodiversity_observations (validation_status);


-- 3. Study areas / commune / parcels / ecological zones
create table if not exists biodiversity_areas (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  area_type text not null default 'study_area'
    check (area_type in ('commune', 'parcel', 'study_area', 'habitat', 'protected_area', 'corridor')),

  description text,

  geom geometry(multipolygon, 4326),

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists biodiversity_areas_geom_idx
  on biodiversity_areas using gist (geom);


-- 4. Media attached to observations
create table if not exists biodiversity_media (
  id uuid primary key default gen_random_uuid(),

  observation_id uuid not null
    references biodiversity_observations(id) on delete cascade,

  media_type text not null
    check (media_type in ('photo', 'audio', 'video', 'document')),

  url text not null,
  storage_path text,

  author text,
  license text,
  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now()
);

create index if not exists biodiversity_media_observation_idx
  on biodiversity_media (observation_id);


-- 5. Optional: validation history
create table if not exists biodiversity_validation_events (
  id uuid primary key default gen_random_uuid(),

  observation_id uuid not null
    references biodiversity_observations(id) on delete cascade,

  status text not null
    check (status in ('unverified', 'probable', 'confirmed', 'rejected')),

  validator_name text,
  validator_id uuid,
  comment text,

  created_at timestamptz default now()
);

create index if not exists biodiversity_validation_observation_idx
  on biodiversity_validation_events (observation_id);

-- Insert some sample data for testing
INSERT INTO biodiversity_taxa (scientific_name, vernacular_name, taxon_rank, kingdom, class_name, order_name, family_name, genus) VALUES
('Quercus ilex', 'Chêne vert', 'species', 'Plantae', 'Magnoliopsida', 'Fagales', 'Fagaceae', 'Quercus'),
('Erinaceus europaeus', 'Hérisson commun', 'species', 'Animalia', 'Mammalia', 'Eulipotyphla', 'Erinaceidae', 'Erinaceus'),
('Parus major', 'Mésange charbonnière', 'species', 'Animalia', 'Aves', 'Passeriformes', 'Paridae', 'Parus')
ON CONFLICT (scientific_name) DO NOTHING;

-- Insert sample observation
INSERT INTO biodiversity_observations (
  taxon_id, 
  scientific_name, 
  vernacular_name, 
  observed_at, 
  observer_name, 
  source, 
  validation_status,
  latitude, 
  longitude
) VALUES
(
  (SELECT id FROM biodiversity_taxa WHERE scientific_name = 'Erinaceus europaeus'),
  'Erinaceus europaeus',
  'Hérisson commun',
  '2024-04-15 20:30:00',
  'Test User',
  'citizen',
  'unverified',
  42.3094,
  9.149
);

-- Enable RLS (Row Level Security)
alter table biodiversity_taxa enable row level security;
alter table biodiversity_observations enable row level security;
alter table biodiversity_areas enable row level security;
alter table biodiversity_media enable row level security;
alter table biodiversity_validation_events enable row level security;

-- Basic RLS policies - adjust according to your security needs
create policy "Public read access to taxa" on biodiversity_taxa
  for select using (true);

create policy "Public read access to observations" on biodiversity_observations
  for select using (true);

create policy "Public read access to areas" on biodiversity_areas
  for select using (true);

create policy "Public read access to media" on biodiversity_media
  for select using (true);

create policy "Public read access to validation events" on biodiversity_validation_events
  for select using (true);

-- Allow authenticated users to insert observations
create policy "Authenticated users can insert observations" on biodiversity_observations
  for insert with check (auth.role() = 'authenticated');

-- Allow users to update their own observations
create policy "Users can update own observations" on biodiversity_observations
  for update using (auth.uid() = observer_id);
