-- Add driver_pending status
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'driver_pending';
