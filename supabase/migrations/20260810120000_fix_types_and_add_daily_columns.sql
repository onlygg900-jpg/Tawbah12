/*
# Critical Fixes Migration (2026-08-10)

1. Fix family_id type mismatch (TEXT → UUID) in family_members and rewards
   so joins against families.id (UUID) actually work. This is the root
   cause of wrong/empty family member data.
2. Add missing columns to daily_progress so ALL user stats actually sync
   (not just pages_read & prayers_completed).
3. Update family_members RLS: add a secondary unique constraint on
   (family_id, user_id) if missing so upserts work reliably.
4. Relax profiles RLS SELECT policy so authenticated members of the same family
   can read each other's display_name/avatar (for family leaderboard).
*/

-- =====================================================================
-- 1. FIX family_id TYPE MISMATCH (TEXT → UUID)
--    (The second migration set these to TEXT; families.id is UUID)
-- =====================================================================

-- First drop policies that depend on the column
DROP POLICY IF EXISTS "family_members_read_same_family" ON family_members;
DROP POLICY IF EXISTS "family_members_insert_self" ON family_members;
DROP POLICY IF EXISTS "family_members_update_self_or_head" ON family_members;
DROP POLICY IF EXISTS "family_members_delete_self" ON family_members;

DROP POLICY IF EXISTS "rewards_read_family_members" ON rewards;
DROP POLICY IF EXISTS "rewards_insert_family_members" ON rewards;
DROP POLICY IF EXISTS "rewards_update_family_members" ON rewards;
DROP POLICY IF EXISTS "rewards_delete_family_head" ON rewards;

-- Safe cast: convert existing TEXT family_ids to UUID by casting via text
ALTER TABLE family_members
  ALTER COLUMN family_id TYPE uuid
  USING family_id::uuid;

ALTER TABLE rewards
  ALTER COLUMN family_id TYPE uuid
  USING family_id::uuid;

-- Now add proper FK references to families(id) with cascade delete
ALTER TABLE family_members
  DROP CONSTRAINT IF EXISTS family_members_family_id_fkey,
  ADD CONSTRAINT family_members_family_id_fkey
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;

ALTER TABLE rewards
  DROP CONSTRAINT IF EXISTS rewards_family_id_fkey,
  ADD CONSTRAINT rewards_family_id_fkey
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;

-- =====================================================================
-- 2. ADD MISSING COLUMNS TO daily_progress
-- =====================================================================

ALTER TABLE daily_progress
  ADD COLUMN IF NOT EXISTS pages_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prayers_on_time integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prayers_late integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prayers_missed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personal_charity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tasbeeh_count integer NOT NULL DEFAULT 0;

-- =====================================================================
-- 3. family_members: ensure (family_id, user_id) is unique for upsert
-- =====================================================================

ALTER TABLE family_members
  DROP CONSTRAINT IF EXISTS family_members_family_id_user_id_key;
ALTER TABLE family_members
  ADD CONSTRAINT family_members_family_id_user_id_key UNIQUE (family_id, user_id);

-- =====================================================================
-- 4. Re-create READ policies after column type changes
-- =====================================================================

-- family_members policies -----------------------------------------
CREATE POLICY "family_members_read_same_family" ON family_members FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM family_members me
      WHERE me.family_id = family_members.family_id
        AND me.user_id = auth.uid()
    )
  );

CREATE POLICY "family_members_insert_self" ON family_members FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

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

CREATE POLICY "family_members_delete_self" ON family_members FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- rewards policies ---------------------------------------------
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
-- 5. Relax profiles SELECT policy (heads + same-family reads for display names)
-- =====================================================================

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;

CREATE POLICY "profiles_select_own_or_family" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1
      FROM family_members my_fm
      JOIN family_members other_fm
        ON other_fm.family_id = my_fm.family_id
      WHERE my_fm.user_id = auth.uid()
        AND other_fm.user_id = profiles.id
    )
  );
