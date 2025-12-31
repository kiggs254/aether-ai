-- Simplify media upload policy - test with a more permissive version first
-- This will help us debug if the issue is with the policy logic or something else

-- Drop the existing policy
DROP POLICY IF EXISTS "Allow authenticated to upload media files" ON storage.objects;

-- Create a simpler policy for testing
-- First, let's allow all authenticated users to upload to Assets bucket
-- We'll add bot ownership verification after confirming this works
CREATE POLICY "Allow authenticated to upload media files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Assets'
  AND (
    -- Allow all uploads to media/... paths (we'll restrict by bot ownership next)
    name ~ '^media/'
    -- Also allow uploads to public/... path (for widget files)
    OR name ~ '^public/'
  )
);

-- Note: This is a temporary permissive policy for testing
-- After confirming uploads work, we should add bot ownership verification:
-- AND EXISTS (
--   SELECT 1 FROM bots
--   WHERE bots.id::text = (string_to_array(name, '/'))[2]
--   AND bots.user_id = auth.uid()
-- )

