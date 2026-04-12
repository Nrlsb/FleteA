-- ============================================================
-- Migration 014: Create trip_offers table for competition
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS trip_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(trip_id, driver_id)
);

-- Enable RLS
ALTER TABLE trip_offers ENABLE ROW LEVEL SECURITY;

-- Policies for trip_offers
DROP POLICY IF EXISTS "trip_offers_select" ON trip_offers;
CREATE POLICY "trip_offers_select" ON trip_offers
    FOR SELECT
    USING (
        auth.uid() = driver_id
        OR auth.uid() IN (SELECT user_id FROM trips WHERE id = trip_id)
    );

DROP POLICY IF EXISTS "trip_offers_insert" ON trip_offers;
CREATE POLICY "trip_offers_insert" ON trip_offers
    FOR INSERT
    WITH CHECK (
        auth.uid() = driver_id
        AND EXISTS (SELECT 1 FROM trips WHERE id = trip_id AND status = 'pending')
    );

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE trip_offers;

-- Refresh PostgREST
NOTIFY pgrst, 'reload schema';
