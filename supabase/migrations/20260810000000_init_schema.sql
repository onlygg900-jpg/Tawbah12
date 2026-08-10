/*
# Tawbah — Single Source of Truth Migration
Run ONCE (or multiple times: idempotent) in Supabase SQL Editor.

Safe for existing data:
  - profiles (14 rows) and daily_progress (4 rows) are preserved and ALTERED only.
  - families/family_members/rewards are recreated cleanly (they're empty remotely).

Everything below is needed for the app to work. No extra/removed code.
*/

-- =====================================================================
-- 1. EMPTY TABLES (families / family_members / rewards) — RECREATE CLEAN
-- =====================================================================
DROP TABLE IF EXISTS rewards         CASCADE;
DROP TABLE IF EXISTS family_members  CASCADE;
DROP TABLE IF EXISTS families        CASCADE;

CREATE TABLE families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'عائلة توبة',
  code text NOT NULL UNIQUE,
  currency text NOT NULL DEFAULT 'ج.م',
  treasury_balance numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'عضو',
  is_head boolean NOT NULL DEFAULT false,
  points integer NOT NULL DEFAULT 0,
  prayers_today integer NOT NULL DEFAULT 0,
  total_prayers integer NOT NULL DEFAULT 0,
  pages_today integer NOT NULL DEFAULT 0,
  total_pages integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (family_id, user_id)
);

CREATE TABLE rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'جائزة',
  description text DEFAULT '',
  reward_type text NOT NULL DEFAULT 'custom',
  target integer NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ج.م',
  redeemed_today boolean NOT NULL DEFAULT false,
  last_redeemed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- =====================================================================
-- 2. profiles — PRESERVE DATA, add only missing columns
-- =====================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_color text DEFAULT '#d97706';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- =====================================================================
-- 3. daily_progress — PRESERVE DATA, fix type + add missing columns
-- =====================================================================
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'daily_progress' AND column_name = 'date';
  IF col_type = 'date' THEN
    ALTER TABLE daily_progress
      ALTER COLUMN date TYPE text
      USING to_char(date, 'YYYY-MM-DD');
  END IF;
END $$;

ALTER TABLE daily_progress ADD COLUMN IF NOT EXISTS pages_today      integer NOT NULL DEFAULT 0;
ALTER TABLE daily_progress ADD COLUMN IF NOT EXISTS prayers_on_time  integer NOT NULL DEFAULT 0;
ALTER TABLE daily_progress ADD COLUMN IF NOT EXISTS prayers_late     integer NOT NULL DEFAULT 0;
ALTER TABLE daily_progress ADD COLUMN IF NOT EXISTS prayers_missed   integer NOT NULL DEFAULT 0;
ALTER TABLE daily_progress ADD COLUMN IF NOT EXISTS personal_charity numeric NOT NULL DEFAULT 0;
ALTER TABLE daily_progress ADD COLUMN IF NOT EXISTS streak_days      integer NOT NULL DEFAULT 0;
ALTER TABLE daily_progress ADD COLUMN IF NOT EXISTS tasbeeh_count    integer NOT NULL DEFAULT 0;

-- =====================================================================
-- 4. RLS — ENABLE + CLEAN SLATE POLICIES on all 5 tables
-- =====================================================================
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE families        ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_progress  ENABLE ROW LEVEL SECURITY;

-- Helper: drop all known old policies before recreating (safety belt)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname='public'
           AND tablename IN ('profiles','families','family_members','rewards','daily_progress')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- -------------------- profiles --------------------
CREATE POLICY p_profiles_sel ON profiles FOR SELECT TO authenticated USING (
  auth.uid() = id OR EXISTS (
    SELECT 1 FROM family_members a JOIN family_members b ON b.family_id=a.family_id
    WHERE a.user_id=auth.uid() AND b.user_id=profiles.id
  )
);
CREATE POLICY p_profiles_ins ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()=id);
CREATE POLICY p_profiles_upd ON profiles FOR UPDATE TO authenticated USING (auth.uid()=id) WITH CHECK (auth.uid()=id);
CREATE POLICY p_profiles_del ON profiles FOR DELETE TO authenticated USING (auth.uid()=id);

-- -------------------- families --------------------
CREATE POLICY p_families_sel ON families FOR SELECT TO authenticated USING (
  created_by=auth.uid() OR EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id=families.id AND fm.user_id=auth.uid())
);
CREATE POLICY p_families_ins ON families FOR INSERT TO authenticated WITH CHECK (auth.uid()=created_by);
CREATE POLICY p_families_upd ON families FOR UPDATE TO authenticated
  USING (created_by=auth.uid() OR EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id=families.id AND fm.user_id=auth.uid() AND fm.is_head=true))
  WITH CHECK (created_by=auth.uid() OR EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id=families.id AND fm.user_id=auth.uid() AND fm.is_head=true));

-- -------------------- family_members --------------------
CREATE POLICY p_fm_sel ON family_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM family_members me WHERE me.family_id=family_members.family_id AND me.user_id=auth.uid())
);
CREATE POLICY p_fm_ins ON family_members FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY p_fm_upd ON family_members FOR UPDATE TO authenticated
  USING (auth.uid()=user_id OR EXISTS (SELECT 1 FROM family_members h WHERE h.family_id=family_members.family_id AND h.user_id=auth.uid() AND h.is_head=true))
  WITH CHECK (auth.uid()=user_id OR EXISTS (SELECT 1 FROM family_members h WHERE h.family_id=family_members.family_id AND h.user_id=auth.uid() AND h.is_head=true));
CREATE POLICY p_fm_del ON family_members FOR DELETE TO authenticated USING (
  auth.uid()=user_id OR EXISTS (SELECT 1 FROM family_members h WHERE h.family_id=family_members.family_id AND h.user_id=auth.uid() AND h.is_head=true)
);

-- -------------------- rewards --------------------
CREATE POLICY p_rewards_sel ON rewards FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id=rewards.family_id AND fm.user_id=auth.uid())
);
CREATE POLICY p_rewards_ins ON rewards FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id=rewards.family_id AND fm.user_id=auth.uid())
);
CREATE POLICY p_rewards_upd ON rewards FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id=rewards.family_id AND fm.user_id=auth.uid() AND fm.is_head=true))
  WITH CHECK (EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id=rewards.family_id AND fm.user_id=auth.uid() AND fm.is_head=true));
CREATE POLICY p_rewards_del ON rewards FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id=rewards.family_id AND fm.user_id=auth.uid() AND fm.is_head=true)
);

-- -------------------- daily_progress --------------------
CREATE POLICY p_dp_sel ON daily_progress FOR SELECT TO authenticated USING (
  auth.uid()=user_id OR EXISTS (
    SELECT 1 FROM family_members a JOIN family_members b ON b.family_id=a.family_id
    WHERE a.user_id=auth.uid() AND b.user_id=daily_progress.user_id
  )
);
CREATE POLICY p_dp_ins ON daily_progress FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY p_dp_upd ON daily_progress FOR UPDATE TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY p_dp_del ON daily_progress FOR DELETE TO authenticated USING (auth.uid()=user_id);

-- =====================================================================
-- 5. RPC: SECURITY DEFINER helpers for invite-code join
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_family_id_by_code(input_code text)
  RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE f uuid;
BEGIN
  IF input_code IS NULL OR length(trim(input_code))=0 THEN RETURN NULL; END IF;
  SELECT id INTO f FROM public.families WHERE upper(code)=upper(trim(input_code)) LIMIT 1;
  RETURN f;
END $$;
GRANT EXECUTE ON FUNCTION public.get_family_id_by_code(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.peek_family_by_code(input_code text)
  RETURNS TABLE (id uuid, name text, currency text)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF input_code IS NULL OR length(trim(input_code))=0 THEN RETURN; END IF;
  RETURN QUERY SELECT f.id, f.name, f.currency FROM public.families f
    WHERE upper(f.code)=upper(trim(input_code)) LIMIT 1;
END $$;
GRANT EXECUTE ON FUNCTION public.peek_family_by_code(text) TO authenticated;

-- =====================================================================
-- 6. Indexes
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_families_code            ON families(code);
CREATE INDEX IF NOT EXISTS idx_family_members_family    ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user      ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_family           ON rewards(family_id);
CREATE INDEX IF NOT EXISTS idx_daily_progress_user_date ON daily_progress(user_id, date);
