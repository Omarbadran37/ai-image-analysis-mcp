// Supabase upload module for ORBIT Gemini Image Analysis MCP

import { createClient } from '@supabase/supabase-js';
import { UploadResult } from './types.js';
import { SECURITY_CONFIG, sanitizeInput } from './security.js';
import { detectMimeType } from '../utils/mime-detection.js';
import { generateImageChecksum } from './integrity.js';
import { getErrorMessage } from '../utils/error-handling.js';

// Secure Supabase upload function with image integrity preservation
export async function uploadToSupabase(
  imageData: string, 
  bucket: string, 
  uploadPath: string, 
  supabaseUrl: string, 
  supabaseKey: string, 
  metadata?: Record<string, any>
): Promise<UploadResult> {
  // Security validations
  try {
    new URL(supabaseUrl); // Validate URL format
  } catch {
    throw new Error('Invalid Supabase URL format');
  }
  
  if (!supabaseKey || supabaseKey.length < 20) {
    throw new Error('Invalid or missing Supabase key');
  }
  
  // Validate path doesn't contain directory traversal
  if (uploadPath.includes('..') || uploadPath.includes('~')) {
    throw new Error('Invalid upload path - potential directory traversal detected');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Convert base64 to buffer with proper binary handling
    const buffer = Buffer.from(imageData, 'base64');
    
    // Validate file size
    if (buffer.length > SECURITY_CONFIG.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size`);
    }
    
    // Detect proper MIME type to preserve format integrity
    const actualMimeType = detectMimeType(uploadPath, buffer);
    
    // Generate integrity checksum for verification
    const originalChecksum = generateImageChecksum(buffer);
    
    // Prepare upload options with proper content type
    const uploadOptions: any = {
      contentType: actualMimeType, // Use actual MIME type instead of forcing jpeg
      upsert: true,
      cacheControl: '3600' // 1 hour cache
    };
    
    if (metadata) {
      // Sanitize metadata and add integrity information
      const sanitizedMetadata: Record<string, any> = {
        original_checksum: originalChecksum,
        original_mime_type: actualMimeType,
        upload_timestamp: new Date().toISOString()
      };
      
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof key === 'string' && key.length < 100 && /^[a-zA-Z0-9_-]+$/.test(key)) {
          if (typeof value === 'string' && value.length < 1000) {
            sanitizedMetadata[key] = sanitizeInput(value);
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            sanitizedMetadata[key] = value;
          }
        }
      }
      uploadOptions.metadata = sanitizedMetadata;
    } else {
      // Add basic integrity metadata even if no custom metadata provided
      uploadOptions.metadata = {
        original_checksum: originalChecksum,
        original_mime_type: actualMimeType,
        upload_timestamp: new Date().toISOString()
      };
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(uploadPath, buffer, uploadOptions);

    if (error) throw error;

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadPath);

    return {
      success: true,
      path: data.path,
      public_url: publicData.publicUrl,
      upload_timestamp: new Date().toISOString(),
      file_size: buffer.length,
      mime_type: actualMimeType,
      integrity_checksum: originalChecksum
    };
  } catch (error) {
    throw new Error(`Supabase upload failed: ${getErrorMessage(error)}`);
  }
}