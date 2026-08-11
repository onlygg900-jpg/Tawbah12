/*
# Tawbah — Profiles + Auto-Create Trigger (Idempotent)
Run ONCE or multiple times in Supabase SQL Editor.

Fixes the error:
  "daily_progress_user_id_fkey — Key (user_id)=(...) is not present in table profiles"

1. Ensures public.profiles table EXISTS with correct columns + FK to auth.users.
2. Creates the standard handle_new_user() function.
3. Attaches a trigger on auth.users so every new signup automatically
   inserts a matching row into public.profiles.
*/

-- =====================================================================
-- 1. profiles — CREATE IF NOT EXISTS (id must match auth.users(id))
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text NOT NULL DEFAULT 'مستخدم توبة',
  email         text NOT NULL DEFAULT '',
  avatar_color  text NOT NULL DEFAULT '#d97706',
  avatar_url    text,
  family_id     uuid,
  role          text DEFAULT 'member',
  points        integer NOT NULL DEFAULT 0,
  prayers_today integer NOT NULL DEFAULT 0,
  total_prayers integer NOT NULL DEFAULT 0,
  pages_today   integer NOT NULL DEFAULT 0,
  total_pages   integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Add any columns that might be missing if the table already existed
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT 'مستخدم توبة';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email        text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_color text NOT NULL DEFAULT '#d97706';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS family_id    uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role         text DEFAULT 'member';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points       integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS prayers_today integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_prayers integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pages_today   integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_pages   integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at    timestamptz NOT NULL DEFAULT now();

-- =====================================================================
-- 2. Trigger function: auto-create profile row after signup
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_color, created_at)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(NEW.email, ''),
      'مستخدم توبة'
    ),
    COALESCE(NEW.email, ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'avatar_color', ''),
      '#d97706'
    ),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- =====================================================================
-- 3. Attach trigger on auth.users (DROP IF EXISTS first for safety)
-- =====================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 4. Enable Row Level Security (MANDATORY — otherwise 403 Forbidden)
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_profiles_sel ON public.profiles;
DROP POLICY IF EXISTS p_profiles_ins ON public.profiles;
DROP POLICY IF EXISTS p_profiles_upd ON public.profiles;

CREATE POLICY p_profiles_sel ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY p_profiles_ins ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY p_profiles_upd ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =====================================================================
-- 5. Backfill: create missing profiles rows for any existing users
--    that already exist in auth.users but not in public.profiles.
--    Runs with the caller's privilege which in SQL Editor is usually superuser,
--    so it bypasses RLS and fills missing rows even for existing users.
-- =====================================================================
INSERT INTO public.profiles (id, display_name, email, created_at)
SELECT
  au.id,
  COALESCE(
    NULLIF(au.raw_user_meta_data->>'full_name', ''),
    NULLIF(au.raw_user_meta_data->>'name', ''),
    NULLIF(au.email, ''),
    'مستخدم توبة'
  ),
  COALESCE(au.email, ''),
  now()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 6. Ensure daily_progress also has RLS + sensible policies
--    (if you applied the old init script these are no-ops — safe to rerun)
-- =====================================================================
ALTER TABLE IF EXISTS public.daily_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_daily_progress_sel ON public.daily_progress;
DROP POLICY IF EXISTS p_daily_progress_ins ON public.daily_progress;
DROP POLICY IF EXISTS p_daily_progress_upd ON public.daily_progress;

CREATE POLICY p_daily_progress_sel ON public.daily_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY p_daily_progress_ins ON public.daily_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY p_daily_progress_upd ON public.daily_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 7. Ensure authenticated role has basic grants (belt + suspenders)
-- =====================================================================
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON TABLE public.profiles       TO authenticated, postgres;
GRANT ALL ON TABLE public.daily_progress TO authenticated, postgres;
GRANT ALL ON TABLE public.challenges     TO authenticated, postgres;
GRANT ALL ON TABLE public.challenge_entries TO authenticated, postgres;
GRANT ALL ON TABLE public.families       TO authenticated, postgres;
GRANT ALL ON TABLE public.family_members TO authenticated, postgres;
GRANT ALL ON TABLE public.daily_quests   TO authenticated, postgres;
GRANT ALL ON TABLE public.quest_progress TO authenticated, postgres;
