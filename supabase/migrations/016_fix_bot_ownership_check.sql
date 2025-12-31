-- Fix bot ownership verification in media upload policy
-- The issue is with UUID comparison - we need to handle it properly

-- Drop the existing policy
DROP POLICY IF EXISTS "Allow authenticated to upload media files" ON storage.objects;

-- Create a more robust policy with proper UUID handling
-- Files are stored in path: media/{botId}/{filename}
-- We'll use a function to safely extract and validate the botId
CREATE POLICY "Allow authenticated to upload media files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Assets' 
  AND (
    -- Allow uploads to media/{botId}/... paths where bot belongs to user
    -- Extract botId from path (index 2 in 1-indexed array) and verify ownership
    (name ~ '^media/[^/]+/' AND EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id::text = (string_to_array(name, '/'))[2]
      AND bots.user_id = auth.uid()
    ))
    -- Also allow uploads to public/... path (for widget files)
    OR name ~ '^public/'
  )
);

