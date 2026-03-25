-- ============================================================
-- Migration 007: Storage bucket + RLS policies for fletea-images
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create bucket if it doesn't exist (public = true for public URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fletea-images', 'fletea-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing storage policies to avoid conflicts
DROP POLICY IF EXISTS "storage_select_public"      ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "storage_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_authenticated" ON storage.objects;

-- 3. Anyone can view files (needed for public photo URLs)
CREATE POLICY "storage_select_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'fletea-images');

-- 4. Authenticated users can upload files
CREATE POLICY "storage_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fletea-images');

-- 5. Authenticated users can update their own files
CREATE POLICY "storage_update_authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'fletea-images');

-- 6. Authenticated users can delete their own files
CREATE POLICY "storage_delete_authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fletea-images');
