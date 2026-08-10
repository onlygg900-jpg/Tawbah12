/*
# Harden RLS Policies — Comprehensive Security Migration (2026-08-10)

Requirements addressed:
  1. Each user can READ/WRITE their own `profiles` + `daily_progress` only.
  2. Members of the SAME family (linked via `family_members.family_id`) can
     READ each other's `daily_progress`, `family_members`, `profiles` names,
     `rewards`, and `families` records so the "عائلة توبة" page works correctly
     with live data (no hardcoded/wrong fallbacks).
  3. No table stays "Unrestricted". Every operation is gated by RLS.

Special care:
- Replaces the open `families FOR SELECT USING (true)` policy with a member-only
  read policy. Joining by invite-code still works via a SECURITY DEFINER
  lookup function that bypasses RLS only for the exact (code -> family id)
  mapping and nothing else.
- Adds the CRITICAL missing policy: `daily_progress` is SELECT-visible to
  authenticated users who share a `family_id` in `family_members`.
- Reinstates profiles INSERT/UPDATE/DELETE policies dropped by a previous
  migration (only `profiles_select_own_or_family` was recreated).
*/

-- =====================================================================
-- 0. Ensure RLS is ENABLED on every single table (belt + suspenders)
-- =====================================================================
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE families        ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_progress  ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 1. Drop EVERY existing policy so we rebuild from a clean slate
-- =====================================================================
DROP POLICY IF EXISTS "select_own_profile"                   ON profiles;
DROP POLICY IF EXISTS "insert_own_profile"                   ON profiles;
DROP POLICY IF EXISTS "update_own_profile"                   ON profiles;
DROP POLICY IF EXISTS "delete_own_profile"                   ON profiles;
DROP POLICY IF EXISTS "profiles_select_own"                  ON profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_family"        ON profiles;

DROP POLICY IF EXISTS "read_families"                        ON families;
DROP POLICY IF EXISTS "insert_families"                      ON families;
DROP POLICY IF EXISTS "update_families"                      ON families;

DROP POLICY IF EXISTS "select_family_members"                ON family_members;
DROP POLICY IF EXISTS "insert_family_members"                ON family_members;
DROP POLICY IF EXISTS "update_family_members"                ON family_members;
DROP POLICY IF EXISTS "delete_family_members"                ON family_members;
DROP POLICY IF EXISTS "family_members_read_same_family"      ON family_members;
DROP POLICY IF EXISTS "family_members_insert_self"           ON family_members;
DROP POLICY IF EXISTS "family_members_update_self_or_head"   ON family_members;
DROP POLICY IF EXISTS "family_members_delete_self"           ON family_members;

DROP POLICY IF EXISTS "select_rewards"                       ON rewards;
DROP POLICY IF EXISTS "insert_rewards"                       ON rewards;
DROP POLICY IF EXISTS "update_rewards"                       ON rewards;
DROP POLICY IF EXISTS "delete_rewards"                       ON rewards;
DROP POLICY IF EXISTS "rewards_read_family_members"          ON rewards;
DROP POLICY IF EXISTS "rewards_insert_family_members"        ON rewards;
DROP POLICY IF EXISTS "rewards_update_family_members"        ON rewards;
DROP POLICY IF EXISTS "rewards_delete_family_head"           ON rewards;

DROP POLICY IF EXISTS "select_own_progress"                  ON daily_progress;
DROP POLICY IF EXISTS "insert_own_progress"                  ON daily_progress;
DROP POLICY IF EXISTS "update_own_progress"                  ON daily_progress;
DROP POLICY IF EXISTS "delete_own_progress"                  ON daily_progress;

-- =====================================================================
-- 2. profiles — OWNER-scoped R/W; same-family members can READ names
-- =====================================================================
CREATE POLICY "profiles_select_own_or_family" ON profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1
      FROM family_members my_fm
      JOIN family_members other_fm ON other_fm.family_id = my_fm.family_id
      WHERE my_fm.user_id = auth.uid()
        AND other_fm.user_id = profiles.id
    )
  );

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own" ON profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = id);

-- =====================================================================
-- 3. families — NO LONGER UNRESTRICTED. Visible only to members/creator.
--    (Invite-code lookups go through the SECURITY DEFINER fn below.)
-- =====================================================================
CREATE POLICY "families_select_member_or_creator" ON families
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = families.id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "families_insert_own" ON families
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "families_update_creator_or_head" ON families
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = families.id
        AND fm.user_id = auth.uid()
        AND fm.is_head = true
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = families.id
        AND fm.user_id = auth.uid()
        AND fm.is_head = true
    )
  );

-- =====================================================================
-- 4. family_members — same-family visibility, strict writes
-- =====================================================================
CREATE POLICY "family_members_select_same_family" ON family_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM family_members me
      WHERE me.family_id = family_members.family_id
        AND me.user_id = auth.uid()
    )
  );

CREATE POLICY "family_members_insert_self" ON family_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "family_members_update_self_or_head" ON family_members
  FOR UPDATE TO authenticated
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

CREATE POLICY "family_members_delete_self_or_head" ON family_members
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM family_members head
      WHERE head.family_id = family_members.family_id
        AND head.user_id = auth.uid()
        AND head.is_head = true
    )
  );

-- =====================================================================
-- 5. rewards — family-scoped reads; head-only deletes
-- =====================================================================
CREATE POLICY "rewards_select_family_member" ON rewards
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "rewards_insert_family_member" ON rewards
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "rewards_update_head_or_member" ON rewards
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
        AND fm.user_id = auth.uid()
        AND fm.is_head = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
        AND fm.user_id = auth.uid()
        AND fm.is_head = true
    )
  );

CREATE POLICY "rewards_delete_family_head" ON rewards
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
        AND fm.user_id = auth.uid()
        AND fm.is_head = true
    )
  );

-- =====================================================================
-- 6. daily_progress — OWNER can CRUD; same-family can READ (!!!)
--    This is the CRITICAL policy for "عائلة توبة" to show real progress.
-- =====================================================================
CREATE POLICY "daily_progress_select_own_or_family" ON daily_progress
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM family_members my_fm
      JOIN family_members other_fm ON other_fm.family_id = my_fm.family_id
      WHERE my_fm.user_id = auth.uid()
        AND other_fm.user_id = daily_progress.user_id
    )
  );

CREATE POLICY "daily_progress_insert_own" ON daily_progress
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_progress_update_own" ON daily_progress
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_progress_delete_own" ON daily_progress
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================================
-- 7. SECURITY DEFINER helper: lookup a family by invite code.
--    Required because `families` is no longer SELECT-able by the public;
--    a user who only knows the invite-code would otherwise not be able
--    to locate the family id they want to JOIN.
--    This fn is safe: it returns only the family.id for an exact code match
--    and does NOT leak any other column values.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_family_id_by_code(input_code text)
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  found_id uuid;
BEGIN
  IF input_code IS NULL OR length(trim(input_code)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO found_id
  FROM public.families
  WHERE upper(code) = upper(trim(input_code))
  LIMIT 1;

  RETURN found_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_family_id_by_code(text) TO authenticated;

-- =====================================================================
-- 8. SECURITY DEFINER helper: minimal family metadata by code.
--    Returns name + currency only so the UI can show "joining X family"
--    without granting full row access pre-membership.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.peek_family_by_code(input_code text)
  RETURNS TABLE (id uuid, name text, currency text)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF input_code IS NULL OR length(trim(input_code)) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT f.id, f.name, f.currency
  FROM public.families f
  WHERE upper(f.code) = upper(trim(input_code))
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.peek_family_by_code(text) TO authenticated;
