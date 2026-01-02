-- Update RLS policy to allow header image uploads
-- Header images are stored in headers/{botId}/ path

DROP POLICY IF EXISTS "Allow authenticated to upload media files" ON storage.objects;

CREATE POLICY "Allow authenticated to upload media files" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'Assets' AND (
    name ~ '^media/' OR 
    name ~ '^public/' OR
    name ~ '^headers/'
  )
);

-- Also allow updates and deletes for header images
CREATE POLICY IF NOT EXISTS "Allow authenticated to update media files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'Assets' AND (
    name ~ '^media/' OR 
    name ~ '^public/' OR
    name ~ '^headers/'
  )
);

CREATE POLICY IF NOT EXISTS "Allow authenticated to delete media files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'Assets' AND (
    name ~ '^media/' OR 
    name ~ '^public/' OR
    name ~ '^headers/'
  )
);

