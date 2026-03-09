-- ============================================================
-- Migration 004: FK relationships + missing columns + RLS
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add missing timestamp columns to trips
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trips_updated_at ON trips;
CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Add FK: trips.user_id → profiles.id
--    (required for PostgREST embedded resource: profiles:user_id(full_name))
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trips_user_id_fkey'
      AND conrelid = 'trips'::regclass
  ) THEN
    ALTER TABLE trips
      ADD CONSTRAINT trips_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Add FK: trips.driver_id → profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trips_driver_id_fkey'
      AND conrelid = 'trips'::regclass
  ) THEN
    ALTER TABLE trips
      ADD CONSTRAINT trips_driver_id_fkey
      FOREIGN KEY (driver_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 4. RLS Policies for trips
-- ============================================================
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "trips_select_own" ON trips;
DROP POLICY IF EXISTS "trips_select_pending" ON trips;
DROP POLICY IF EXISTS "trips_insert_own" ON trips;

-- Users and drivers can read their own trips; anyone authenticated can read pending trips
CREATE POLICY "trips_select_own" ON trips
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = driver_id
    OR status = 'pending'
  );

-- Only authenticated users can insert trips (user_id must match token)
CREATE POLICY "trips_insert_own" ON trips
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. RLS Policies for profiles
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

-- Any authenticated user can read profiles (needed for FK joins)
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- Refresh PostgREST schema cache (run after all changes)
-- ============================================================
NOTIFY pgrst, 'reload schema';
