/*
# Fix: Recreate family_members and related tables with correct schema + RLS

This migration:
1. Drops old tables safely in correct order to avoid FK errors.
2. Recreates profiles, families, family_members (with family_id AS TEXT per spec,
   user_id uuid UNIQUE + FK to auth.users), rewards, daily_progress.
3. Applies correct RLS policies that fix 404/permission errors.
*/

-- =====================================================================
-- CLEANUP: Drop tables in reverse FK order so we always recreate cleanly.
-- =====================================================================
DROP TABLE IF EXISTS rewards CASCADE;
DROP TABLE IF EXISTS daily_progress CASCADE;
DROP TABLE IF EXISTS family_members CASCADE;
DROP TABLE IF EXISTS families CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- =====================================================================
-- 1. PROFILES  (id matches auth.users.id 1:1)
-- =====================================================================
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  display_name text NOT NULL DEFAULT 'مستخدم توبة',
  email text DEFAULT '',
  avatar_color text DEFAULT '#d97706',
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- =====================================================================
-- 2. FAMILIES  (each family has a unique join code)
-- =====================================================================
CREATE TABLE families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'عائلة توبة',
  code text NOT NULL UNIQUE,
  currency text NOT NULL DEFAULT 'ج.م',
  treasury_balance numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can READ families (needed to JOIN by invite code).
CREATE POLICY "families_read_all" ON families FOR SELECT
  TO authenticated USING (true);

-- Only the family creator (head) can INSERT a family record.
CREATE POLICY "families_insert_own" ON families FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

-- Only the family creator can UPDATE the family row.
CREATE POLICY "families_update_creator" ON families FOR UPDATE
  TO authenticated USING (created_by = auth.uid());

-- =====================================================================
-- 3. FAMILY_MEMBERS  (per user-spec: family_id TEXT, user_id UUID UNIQUE+FK)
-- =====================================================================
CREATE TABLE family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id text NOT NULL,                      -- user requested TEXT type
  user_id uuid NOT NULL UNIQUE
    DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'عضو',
  is_head boolean NOT NULL DEFAULT false,
  points integer NOT NULL DEFAULT 0,
  prayers_today integer NOT NULL DEFAULT 0,
  total_prayers integer NOT NULL DEFAULT 0,
  pages_today integer NOT NULL DEFAULT 0,
  total_pages integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- READ: A member can read rows that belong to the SAME family they are in.
--       (Also used by heads to list all members of their family.)
CREATE POLICY "family_members_read_same_family" ON family_members FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM family_members me
      WHERE me.family_id = family_members.family_id
        AND me.user_id = auth.uid()
    )
  );

-- INSERT: A user can ONLY insert a row for THEMSELVES (self-join a family).
CREATE POLICY "family_members_insert_self" ON family_members FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- UPDATE: User can update their OWN row.
--         OR a family HEAD can update any row of their same family.
CREATE POLICY "family_members_update_self_or_head" ON family_members FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM family_members head
      WHERE head.family_id = family_members.family_id
        AND head.user_id = auth.uid()
        AND head.is_head = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM family_members head
      WHERE head.family_id = family_members.family_id
        AND head.user_id = auth.uid()
        AND head.is_head = true
    )
  );

-- DELETE: A user can DELETE their OWN row (leave a family).
CREATE POLICY "family_members_delete_self" ON family_members FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =====================================================================
-- 4. REWARDS  (per family)
-- =====================================================================
CREATE TABLE rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id text NOT NULL,                      -- same type as family_members.family_id
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

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rewards_read_family_members" ON rewards FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "rewards_insert_family_members" ON rewards FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "rewards_update_family_members" ON rewards FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "rewards_delete_family_head" ON rewards FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
        AND fm.user_id = auth.uid()
        AND fm.is_head = true
    )
  );

-- =====================================================================
-- 5. DAILY_PROGRESS  (user_id, date UNIQUE pair -> fixes 409 on insert)
-- =====================================================================
CREATE TABLE daily_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  pages_read integer NOT NULL DEFAULT 0,
  prayers_completed integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, date)
);

ALTER TABLE daily_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_progress_select_own" ON daily_progress FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "daily_progress_insert_own" ON daily_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_progress_update_own" ON daily_progress FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_progress_delete_own" ON daily_progress FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =====================================================================
-- INDEXES  (performance)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_families_code          ON families(code);
CREATE INDEX IF NOT EXISTS idx_family_members_family  ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user    ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_family         ON rewards(family_id);
CREATE INDEX IF NOT EXISTS idx_daily_progress_user_date ON daily_progress(user_id, date);
