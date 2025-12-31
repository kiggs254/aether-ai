import { supabase } from '../lib/supabase';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const ALLOWED_PDF_TYPE = 'application/pdf';

export type MediaType = 'image' | 'audio' | 'pdf' | 'video';

/**
 * Get media type from file
 */
export function getMediaType(file: File): MediaType {
  const mimeType = file.type.toLowerCase();
  
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return 'image';
  }
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) {
    return 'audio';
  }
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    return 'video';
  }
  if (mimeType === ALLOWED_PDF_TYPE) {
    return 'pdf';
  }
  
  // Fallback based on file extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
    return 'image';
  }
  if (['mp3', 'wav', 'ogg', 'webm'].includes(extension || '')) {
    return 'audio';
  }
  if (['mp4', 'webm', 'ogg', 'mov'].includes(extension || '')) {
    return 'video';
  }
  if (extension === 'pdf') {
    return 'pdf';
  }
  
  throw new Error('Unsupported file type');
}

/**
 * Validate file before upload
 */
export function validateMediaFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 10MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    };
  }
  
  // Check file type
  try {
    getMediaType(file);
  } catch (error) {
    return {
      valid: false,
      error: 'Unsupported file type. Please upload an image, audio, PDF, or video file.'
    };
  }
  
  return { valid: true };
}

/**
 * Sanitize filename to prevent path traversal and special characters
 * Supabase storage requires URL-safe filenames
 */
function sanitizeFilename(filename: string): string {
  // Extract just the filename (remove any path)
  const baseName = filename.split(/[\/\\]/).pop() || filename;
  
  // Remove extension temporarily
  const lastDot = baseName.lastIndexOf('.');
  const nameWithoutExt = lastDot > 0 ? baseName.substring(0, lastDot) : baseName;
  const extension = lastDot > 0 ? baseName.substring(lastDot) : '';
  
  // Sanitize the name part: replace spaces and special characters
  const sanitized = nameWithoutExt
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[\/\\<>:"|?*]/g, '_') // Replace dangerous characters
    .replace(/\.\./g, '_') // Replace parent directory references
    .replace(/[^\w\-_.]/g, '_') // Replace any non-word characters (except - and _)
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .trim();
  
  // Ensure we have a valid name
  const finalName = sanitized || 'file';
  
  // Return sanitized name with extension
  return finalName + extension;
}

/**
 * Upload media file to Supabase storage
 * @param botId - The bot ID to associate the file with
 * @param file - The file to upload
 * @returns Public URL of the uploaded file
 */
export async function uploadMediaFile(botId: string, file: File): Promise<string> {
  // Validate file
  const validation = validateMediaFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'File validation failed');
  }
  
  // Get media type
  const mediaType = getMediaType(file);
  
  // Sanitize filename - ensure it's URL-safe
  const sanitizedFilename = sanitizeFilename(file.name);
  
  // Create file path: media/{botId}/{timestamp}-{filename}
  const timestamp = Date.now();
  const filePath = `media/${botId}/${timestamp}-${sanitizedFilename}`;
  
  console.log('Uploading file:', {
    originalName: file.name,
    sanitizedName: sanitizedFilename,
    filePath: filePath,
    fileSize: file.size,
    fileType: file.type
  });
  
  // Check if bucket exists first
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Error listing buckets:', listError);
  } else {
    const assetsBucket = buckets?.find(b => b.id === 'Assets');
    if (!assetsBucket) {
      throw new Error(`Storage bucket 'Assets' not found. Please create it in Supabase Dashboard: Storage > Buckets > New Bucket (Name: Assets, Public: true)`);
    }
  }
  
  // Upload file to Supabase storage
  const { data, error } = await supabase.storage
    .from('Assets')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream'
    });
  
  if (error) {
    console.error('Error uploading file:', error);
    console.error('File path:', filePath);
    console.error('Sanitized filename:', sanitizedFilename);
    console.error('Original filename:', file.name);
    
    // Provide more helpful error messages
    if (error.message?.includes('Invalid key') || error.message?.includes('not found') || error.message?.includes('Bucket')) {
      throw new Error(`Storage bucket 'Assets' not found. Please create it in Supabase Dashboard: Storage > Buckets > New Bucket (Name: Assets, Public: true)`);
    }
    
    throw new Error(`Failed to upload file: ${error.message}`);
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('Assets')
    .getPublicUrl(filePath);
  
  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL for uploaded file');
  }
  
  return urlData.publicUrl;
}

/**
 * Delete media file from Supabase storage
 * @param fileUrl - The public URL of the file to delete
 */
export async function deleteMediaFile(fileUrl: string): Promise<void> {
  try {
    // Extract file path from URL
    // URL format: https://{project}.supabase.co/storage/v1/object/public/Assets/media/{botId}/{filename}
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    const assetsIndex = pathParts.indexOf('Assets');
    
    if (assetsIndex === -1 || assetsIndex === pathParts.length - 1) {
      throw new Error('Invalid file URL format');
    }
    
    // Reconstruct path: media/{botId}/{filename}
    const filePath = pathParts.slice(assetsIndex + 1).join('/');
    
    // Delete file
    const { error } = await supabase.storage
      .from('Assets')
      .remove([filePath]);
    
    if (error) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in deleteMediaFile:', error);
    throw error;
  }
}

