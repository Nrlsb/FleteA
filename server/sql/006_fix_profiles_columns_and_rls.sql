-- ============================================================
-- Migration 006: Ensure profiles columns exist + fix RLS
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Ensure all required columns exist in profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS full_name    TEXT,
  ADD COLUMN IF NOT EXISTS role         TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_lat   FLOAT,
  ADD COLUMN IF NOT EXISTS driver_lon   FLOAT,
  ADD COLUMN IF NOT EXISTS max_cargo_weight INTEGER,
  ADD COLUMN IF NOT EXISTS vehicle_dimensions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- 2. Fix RLS: allow anonymous reads for available drivers
--    (UserDashboard needs to show drivers on the map without auth)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing select policy and replace with one that allows anon reads
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;

-- Authenticated users can read any profile (needed for FK joins)
-- Anon users can only read available drivers (for the map)
CREATE POLICY "profiles_select_any" ON profiles
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    OR (
      auth.role() = 'anon'
      AND role = 'driver'
      AND is_available = true
    )
  );

-- Keep existing update/insert policies (no change needed)

-- ============================================================
-- 3. Refresh PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
