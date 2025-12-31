-- Fix RLS policy for media file uploads
-- The policy needs to verify that the bot belongs to the authenticated user

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "Allow authenticated to upload media files" ON storage.objects;

-- Create a more specific policy that verifies bot ownership
-- Files are stored in path: media/{botId}/{filename}
-- We need to verify that the botId in the path belongs to the authenticated user
CREATE POLICY "Allow authenticated to upload media files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Assets' 
  AND (
    -- Allow uploads to media/{botId}/... paths where bot belongs to user
    (name LIKE 'media/%' AND EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id::text = (string_to_array(name, '/'))[2]
      AND bots.user_id = auth.uid()
    ))
    -- Also allow uploads to public/... path (for widget files)
    OR name LIKE 'public/%'
  )
);

