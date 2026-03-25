-- Add missing values to the trip_status enum
-- We need to execute these one by one as ALTER TYPE cannot run in a transaction block usually in some clients, 
-- but Supabase SQL editor handles it fine.

-- Add any missing statuses used by the frontend
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'loading';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'cancelled';
