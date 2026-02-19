-- Add missing values to the vehicle_type enum
-- We need to execute these one by one as ALTER TYPE cannot run in a transaction block usually in some clients, 
-- but Supabase SQL editor handles it fine.

ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'flete_chico';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'flete_mediano';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'mudancera';
