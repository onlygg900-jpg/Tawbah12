/*
# Create family and quran tracking schema

1. New Tables
- `profiles`: user profile data (display name, email, avatar, stats). id matches auth.users id.
- `families`: family groups with invite code, currency, treasury balance.
- `family_members`: join table linking users to families with per-member stats. Replaces storing family_id directly on profiles.
- `rewards`: family rewards with type, target, amount, redemption state.
- `daily_progress`: per-user daily tracking of Quran pages and prayers.

2. Security
- RLS enabled on all tables.
- profiles: owner-scoped (auth.uid() = id) for all CRUD.
- families: any authenticated user can read (to find by code), only head/creator can update.
- family_members: members can read their own family's members; self-insert on join; self-update; head can update members of their family.
- rewards: family members can read; any member can insert; only inserter can update/delete.
- daily_progress: owner-scoped (auth.uid() = user_id).

3. Notes
- profiles.id defaults to auth.uid() so profile creation works without explicitly passing id.
- family_members.user_id defaults to auth.uid() for self-join inserts.
- family_members has a unique constraint on user_id so a user can only be in one family.
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  display_name text NOT NULL DEFAULT 'مستخدم توبة',
  email text DEFAULT '',
  avatar_color text DEFAULT '#d97706',
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- Families table
CREATE TABLE IF NOT EXISTS families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'عائلة توبة',
  code text NOT NULL,
  currency text NOT NULL DEFAULT 'ج.م',
  treasury_balance numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE families ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_families" ON families;
CREATE POLICY "read_families" ON families FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_families" ON families;
CREATE POLICY "insert_families" ON families FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "update_families" ON families;
CREATE POLICY "update_families" ON families FOR UPDATE
  TO authenticated USING (created_by = auth.uid());

-- Family members join table
CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'عضو',
  is_head boolean NOT NULL DEFAULT false,
  points integer NOT NULL DEFAULT 0,
  prayers_today integer NOT NULL DEFAULT 0,
  total_prayers integer NOT NULL DEFAULT 0,
  pages_today integer NOT NULL DEFAULT 0,
  total_pages integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_family_members" ON family_members;
CREATE POLICY "select_family_members" ON family_members FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = family_members.family_id
      AND fm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_family_members" ON family_members;
CREATE POLICY "insert_family_members" ON family_members FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_family_members" ON family_members;
CREATE POLICY "update_family_members" ON family_members FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = family_members.family_id
      AND fm.user_id = auth.uid()
      AND fm.is_head = true
    )
  ) WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = family_members.family_id
      AND fm.user_id = auth.uid()
      AND fm.is_head = true
    )
  );

DROP POLICY IF EXISTS "delete_family_members" ON family_members;
CREATE POLICY "delete_family_members" ON family_members FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Rewards table
CREATE TABLE IF NOT EXISTS rewards (
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

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_rewards" ON rewards;
CREATE POLICY "select_rewards" ON rewards FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
      AND fm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_rewards" ON rewards;
CREATE POLICY "insert_rewards" ON rewards FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
      AND fm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_rewards" ON rewards;
CREATE POLICY "update_rewards" ON rewards FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
      AND fm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_rewards" ON rewards;
CREATE POLICY "delete_rewards" ON rewards FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_id = rewards.family_id
      AND fm.user_id = auth.uid()
      AND fm.is_head = true
    )
  );

-- Daily progress table
CREATE TABLE IF NOT EXISTS daily_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  pages_read integer NOT NULL DEFAULT 0,
  prayers_completed integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

ALTER TABLE daily_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_progress" ON daily_progress;
CREATE POLICY "select_own_progress" ON daily_progress FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_progress" ON daily_progress;
CREATE POLICY "insert_own_progress" ON daily_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_progress" ON daily_progress;
CREATE POLICY "update_own_progress" ON daily_progress FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_progress" ON daily_progress;
CREATE POLICY "delete_own_progress" ON daily_progress FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_family_id ON rewards(family_id);
CREATE INDEX IF NOT EXISTS idx_daily_progress_user_date ON daily_progress(user_id, date);
CREATE INDEX IF NOT EXISTS idx_families_code ON families(code);
