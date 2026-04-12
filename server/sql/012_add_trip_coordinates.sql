-- ============================================================
-- Migration 012: Add missing coordinate columns to trips table
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS origin_lat       FLOAT,
  ADD COLUMN IF NOT EXISTS origin_lon       FLOAT,
  ADD COLUMN IF NOT EXISTS destination_lat  FLOAT,
  ADD COLUMN IF NOT EXISTS destination_lon  FLOAT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
