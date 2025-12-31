-- Fix bot ownership verification - use COUNT instead of EXISTS
-- EXISTS might not work correctly in storage RLS context

-- Drop the existing policy
DROP POLICY IF EXISTS "Allow authenticated to upload media files" ON storage.objects;

-- Create policy with COUNT-based check (more reliable in storage RLS)
CREATE POLICY "Allow authenticated to upload media files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Assets' 
  AND (
    -- Allow uploads to media/{botId}/... paths where bot belongs to user
    -- Extract botId from path (array index 2) and verify ownership
    (name ~ '^media/[^/]+/' AND (
      SELECT COUNT(*) > 0
      FROM bots
      WHERE bots.id::text = (string_to_array(name, '/'))[2]
      AND bots.user_id = auth.uid()
    ))
    -- Also allow uploads to public/... path (for widget files)
    OR name ~ '^public/'
  )
);

