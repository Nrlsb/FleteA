-- ============================================================
-- Migration 013: Enable Realtime for trips table
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add the trips table to the supabase_realtime publication
-- This allows clients to receive push notifications on row changes
ALTER PUBLICATION supabase_realtime ADD TABLE trips;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
