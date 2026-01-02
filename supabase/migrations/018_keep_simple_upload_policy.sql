-- Keep the simple upload policy that works
-- Bot ownership verification is handled at the application level in services/storage.ts
-- This avoids RLS complexity issues with cross-table queries in storage policies

-- Drop any existing policy
DROP POLICY IF EXISTS "Allow authenticated to upload media files" ON storage.objects;

-- Create simple policy that allows authenticated users to upload to Assets bucket
-- Security is enforced at application level by verifying bot ownership before upload
CREATE POLICY "Allow authenticated to upload media files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Assets'
  AND (
    name ~ '^media/'
    OR name ~ '^public/'
    OR name ~ '^headers/'
  )
);

