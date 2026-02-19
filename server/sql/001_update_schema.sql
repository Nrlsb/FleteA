-- Add new columns to trips table
ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS photos TEXT[],
ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS proof_loading_photo TEXT,
ADD COLUMN IF NOT EXISTS proof_delivery_photo TEXT,
ADD COLUMN IF NOT EXISTS driver_lat FLOAT,
ADD COLUMN IF NOT EXISTS driver_lon FLOAT;

-- Add new columns to profiles table for vehicle dimensions
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS vehicle_dimensions JSONB DEFAULT '{}'::jsonb;

-- Update the valid status check constraints if existing constraint allows only specific values
-- (Assuming standard text column first, if enum type used, we'd need to alter type)
-- For now, just a comment as we use text status.
