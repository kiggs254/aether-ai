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
 * Supabase storage requires URL-safe filenames without spaces or special chars
 */
function sanitizeFilename(filename: string): string {
  // Extract just the filename (remove any path)
  const baseName = filename.split(/[\/\\]/).pop() || filename;
  
  // Remove extension temporarily
  const lastDot = baseName.lastIndexOf('.');
  const nameWithoutExt = lastDot > 0 ? baseName.substring(0, lastDot) : baseName;
  const extension = lastDot > 0 ? baseName.substring(lastDot).toLowerCase() : '';
  
  // Supabase Storage requires URL-safe filenames
  // Only allow: alphanumeric, hyphens, underscores, and dots
  // Replace everything else with underscores
  let sanitized = nameWithoutExt
    .replace(/[^a-zA-Z0-9\-_.]/g, '_') // Replace ANY non-allowed character with underscore
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .trim();
  
  // If after sanitization we have nothing, use a default
  if (!sanitized || sanitized.length === 0) {
    sanitized = 'file';
  }
  
  // Limit length to avoid issues (keep it reasonable, e.g., 200 chars)
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }
  
  // Return sanitized name with extension
  let finalName = sanitized + extension;
  
  // Final safety check: ensure no problematic characters remain
  // This should never happen, but just in case
  finalName = finalName.replace(/[^a-zA-Z0-9\-_.]/g, '_');
  
  // Final validation: ensure the name is not empty
  if (!finalName || finalName.trim().length === 0) {
    finalName = 'file' + (extension || '.bin');
  }
  
  return finalName;
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
  
  // Double-check: ensure no spaces or invalid characters in the final filename
  if (sanitizedFilename.includes(' ') || sanitizedFilename.includes('/') || sanitizedFilename.includes('\\')) {
    console.error('Filename sanitization failed! Original:', file.name, 'Sanitized:', sanitizedFilename);
    throw new Error('Filename contains invalid characters after sanitization. Please rename the file.');
  }
  
  // Create file path: media/{botId}/{timestamp}-{filename}
  const timestamp = Date.now();
  const filePath = `media/${botId}/${timestamp}-${sanitizedFilename}`;
  
  // Final validation: ensure path doesn't contain spaces
  if (filePath.includes(' ')) {
    console.error('File path contains spaces! Path:', filePath);
    throw new Error('File path contains invalid characters. Please try a different filename.');
  }
  
  console.log('Uploading file:', {
    originalName: file.name,
    sanitizedName: sanitizedFilename,
    filePath: filePath,
    fileSize: file.size,
    fileType: file.type
  });
  
  // Upload file to Supabase storage
  // Note: We skip bucket existence check since listBuckets() may require special permissions
  // If the bucket doesn't exist, Supabase will return a clear error message
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
    if (error.message?.includes('Invalid key')) {
      // This usually means the filename/path has invalid characters
      throw new Error(`Invalid file path. The filename may contain unsupported characters. Please try renaming the file.`);
    }
    
    if (error.message?.includes('not found') || error.message?.includes('Bucket') || error.message?.includes('does not exist')) {
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

