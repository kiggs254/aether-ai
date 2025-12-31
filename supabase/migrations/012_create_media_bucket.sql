-- Create Assets storage bucket for bot media files
-- Note: If the bucket doesn't exist, create it via Supabase Dashboard:
-- Storage > Buckets > New Bucket > Name: "Assets", Public: true

-- Attempt to create bucket if it doesn't exist (may fail if storage extension not enabled)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'Assets',
  'Assets',
  true,
  10485760, -- 10MB in bytes
  ARRAY['image/*', 'audio/*', 'application/pdf', 'video/*']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Assets bucket

-- Allow anonymous users to read files (for widget access)
CREATE POLICY IF NOT EXISTS "Allow anonymous to read media files"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'Assets');

-- Allow authenticated users to upload files
CREATE POLICY IF NOT EXISTS "Allow authenticated to upload media files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Assets');

-- Allow authenticated users to update their own files
-- Files are stored in path: media/{botId}/{filename}
-- We check that the botId in the path matches a bot owned by the user
CREATE POLICY IF NOT EXISTS "Allow authenticated to update own media files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'Assets' AND
  EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id::text = (string_to_array(name, '/'))[2]
    AND bots.user_id = auth.uid()
  )
);

-- Allow authenticated users to delete their own files
CREATE POLICY IF NOT EXISTS "Allow authenticated to delete own media files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'Assets' AND
  EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id::text = (string_to_array(name, '/'))[2]
    AND bots.user_id = auth.uid()
  )
);
