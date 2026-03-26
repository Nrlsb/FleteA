-- Add rated flags to trips table
ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS client_rated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS driver_rated BOOLEAN DEFAULT FALSE;

-- Optional: Update existing completed trips that have ratings as true
-- (This requires the ratings table already has entries for these trips)
UPDATE trips
SET client_rated = TRUE
WHERE id IN (SELECT trip_id FROM ratings WHERE reviewer_id IN (SELECT id FROM profiles WHERE role = 'client'));

UPDATE trips
SET driver_rated = TRUE
WHERE id IN (SELECT trip_id FROM ratings WHERE reviewer_id IN (SELECT id FROM profiles WHERE role = 'driver'));
