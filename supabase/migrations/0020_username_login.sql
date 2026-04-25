-- Migration 0020: Username-based login + extend role list
-- Username + password accounts (no email needed). Supabase still stores an
-- internal synthetic email `{username}@ducphuccoffee.local`.

----------------------------------------------------------------------
-- 1. profiles.username (nullable, unique when present)
----------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

-- Case-insensitive uniqueness. Null allowed (for legacy users without one).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

----------------------------------------------------------------------
-- 2. Extend org_members.role CHECK to include roastery_manager + delivery
----------------------------------------------------------------------
ALTER TABLE public.org_members DROP CONSTRAINT IF EXISTS org_members_role_check;
ALTER TABLE public.org_members ADD CONSTRAINT org_members_role_check
  CHECK (role IN ('admin','manager','roastery_manager','warehouse','sales','collaborator','delivery'));
