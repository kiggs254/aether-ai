-- Add bot ownership verification to media upload policy
-- This ensures users can only upload files for bots they own

-- Drop the simplified test policy
DROP POLICY IF EXISTS "Allow authenticated to upload media files" ON storage.objects;

-- Create the secure policy with bot ownership verification
-- Files are stored in path: media/{botId}/{filename}
-- PostgreSQL arrays are 1-indexed, so:
--   string_to_array('media/botId/filename', '/') = ['media', 'botId', 'filename']
--   [1] = 'media', [2] = 'botId', [3] = 'filename'
CREATE POLICY "Allow authenticated to upload media files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Assets' 
  AND (
    -- Allow uploads to media/{botId}/... paths where bot belongs to user
    (name ~ '^media/[^/]+/' AND EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id::text = (string_to_array(name, '/'))[2]
      AND bots.user_id = auth.uid()
    ))
    -- Also allow uploads to public/... path (for widget files)
    OR name ~ '^public/'
  )
);

