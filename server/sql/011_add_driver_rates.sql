-- ============================================================
-- Migration 011: Add driver specific rates to profiles
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS base_price      NUMERIC,
  ADD COLUMN IF NOT EXISTS price_per_km    NUMERIC,
  ADD COLUMN IF NOT EXISTS helper_price    NUMERIC,
  ADD COLUMN IF NOT EXISTS packing_price   NUMERIC;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
