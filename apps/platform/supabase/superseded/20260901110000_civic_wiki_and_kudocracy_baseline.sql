-- ============================================================================
-- Migration: 20260901110000_civic_wiki_and_kudocracy_baseline.sql
-- Description: Baseline schema for Civic Wiki & Kudocracy on multi-instance platform
-- References: JeanHuguesRobert/inseme#59, #32, #17, #57
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Table public.wiki_pages
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wiki_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.instances(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  summary text,
  author_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  fts_tokens tsvector,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT wiki_pages_instance_slug_key UNIQUE (instance_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_wiki_pages_instance_id ON public.wiki_pages(instance_id);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_slug ON public.wiki_pages(slug);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_author_id ON public.wiki_pages(author_id);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_updated_at ON public.wiki_pages(updated_at DESC);

-- Automatic FTS token trigger for wiki search
CREATE OR REPLACE FUNCTION public.update_wiki_pages_fts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.fts_tokens := setweight(to_tsvector('french', COALESCE(NEW.title, '')), 'A') ||
                    setweight(to_tsvector('french', COALESCE(NEW.summary, '')), 'B') ||
                    setweight(to_tsvector('french', COALESCE(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_wiki_pages_fts ON public.wiki_pages;
CREATE TRIGGER trigger_wiki_pages_fts
  BEFORE INSERT OR UPDATE OF title, summary, content
  ON public.wiki_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wiki_pages_fts();

-- ----------------------------------------------------------------------------
-- 2. Table public.git_sync_log (Wiki provenance and commit tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.git_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.instances(id) ON DELETE CASCADE,
  page_id uuid REFERENCES public.wiki_pages(id) ON DELETE CASCADE,
  commit_hash text NOT NULL,
  commit_message text,
  synced_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  last_sync_date timestamptz DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_git_sync_log_page_id ON public.git_sync_log(page_id);
CREATE INDEX IF NOT EXISTS idx_git_sync_log_instance_id ON public.git_sync_log(instance_id);

-- ----------------------------------------------------------------------------
-- 3. Table public.tags (Kudocracy and categorization)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT tags_instance_name_key UNIQUE (instance_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_instance_id ON public.tags(instance_id);

-- ----------------------------------------------------------------------------
-- 4. Table public.propositions (Kudocracy proposals)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.propositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.instances(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  author_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'draft')),
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_propositions_instance_id ON public.propositions(instance_id);
CREATE INDEX IF NOT EXISTS idx_propositions_author_id ON public.propositions(author_id);
CREATE INDEX IF NOT EXISTS idx_propositions_status ON public.propositions(status);
CREATE INDEX IF NOT EXISTS idx_propositions_created_at ON public.propositions(created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Table public.proposition_tags
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proposition_tags (
  proposition_id uuid NOT NULL REFERENCES public.propositions(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (proposition_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_proposition_tags_tag_id ON public.proposition_tags(tag_id);

-- ----------------------------------------------------------------------------
-- 6. Table public.votes (Kudocracy direct votes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  proposition_id uuid NOT NULL REFERENCES public.propositions(id) ON DELETE CASCADE,
  vote_value text NOT NULL
    CHECK (vote_value IN ('approve', 'disapprove', 'neutral', 'false_choice')),
  delegated_from_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT votes_user_proposition_key UNIQUE (user_id, proposition_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_proposition_id ON public.votes(proposition_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON public.votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_instance_id ON public.votes(instance_id);

-- ----------------------------------------------------------------------------
-- 7. Table public.delegations (Liquid democracy delegations)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.instances(id) ON DELETE CASCADE,
  delegator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  delegate_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'paused')),
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT delegations_no_self_delegation CHECK (delegator_id <> delegate_id)
);

CREATE INDEX IF NOT EXISTS idx_delegations_delegator_id ON public.delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_delegations_delegate_id ON public.delegations(delegate_id);
CREATE INDEX IF NOT EXISTS idx_delegations_tag_id ON public.delegations(tag_id);
CREATE INDEX IF NOT EXISTS idx_delegations_instance_id ON public.delegations(instance_id);

-- ----------------------------------------------------------------------------
-- 8. Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.wiki_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.git_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposition_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegations ENABLE ROW LEVEL SECURITY;

-- Wiki Pages
DROP POLICY IF EXISTS "Public can read wiki pages" ON public.wiki_pages;
CREATE POLICY "Public can read wiki pages"
  ON public.wiki_pages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create wiki pages" ON public.wiki_pages;
CREATE POLICY "Authenticated users can create wiki pages"
  ON public.wiki_pages FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update wiki pages" ON public.wiki_pages;
CREATE POLICY "Authenticated users can update wiki pages"
  ON public.wiki_pages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Tags
DROP POLICY IF EXISTS "Public can read tags" ON public.tags;
CREATE POLICY "Public can read tags"
  ON public.tags FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create tags" ON public.tags;
CREATE POLICY "Authenticated users can create tags"
  ON public.tags FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Propositions
DROP POLICY IF EXISTS "Public can read propositions" ON public.propositions;
CREATE POLICY "Public can read propositions"
  ON public.propositions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create propositions" ON public.propositions;
CREATE POLICY "Authenticated users can create propositions"
  ON public.propositions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = author_id);

DROP POLICY IF EXISTS "Authors can update own propositions" ON public.propositions;
CREATE POLICY "Authors can update own propositions"
  ON public.propositions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = author_id)
  WITH CHECK ((select auth.uid()) = author_id);

-- Proposition Tags
DROP POLICY IF EXISTS "Public can read proposition tags" ON public.proposition_tags;
CREATE POLICY "Public can read proposition tags"
  ON public.proposition_tags FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can link tags to propositions" ON public.proposition_tags;
CREATE POLICY "Authenticated users can link tags to propositions"
  ON public.proposition_tags FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Votes
DROP POLICY IF EXISTS "Public can read votes" ON public.votes;
CREATE POLICY "Public can read votes"
  ON public.votes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create own votes" ON public.votes;
CREATE POLICY "Users can create own votes"
  ON public.votes FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own votes" ON public.votes;
CREATE POLICY "Users can update own votes"
  ON public.votes FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Delegations
DROP POLICY IF EXISTS "Public can read delegations" ON public.delegations;
CREATE POLICY "Public can read delegations"
  ON public.delegations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own delegations" ON public.delegations;
CREATE POLICY "Users can manage own delegations"
  ON public.delegations FOR ALL
  TO authenticated
  USING ((select auth.uid()) = delegator_id)
  WITH CHECK ((select auth.uid()) = delegator_id);

-- Git Sync Log
DROP POLICY IF EXISTS "Public can read git sync logs" ON public.git_sync_log;
CREATE POLICY "Public can read git sync logs"
  ON public.git_sync_log FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert git sync logs" ON public.git_sync_log;
CREATE POLICY "Authenticated users can insert git sync logs"
  ON public.git_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
