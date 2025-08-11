// Image integrity and checksum utilities for ORBIT Gemini Image Analysis MCP

import crypto from 'crypto';
import path from 'path';
import { IntegrityInfo } from './types.js';

// Generate integrity checksum for verification
export function generateImageChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Validate image path for security
export function validateImagePath(imagePath: string): boolean {
  // Prevent directory traversal
  if (imagePath.includes('..') || imagePath.includes('~')) {
    return false;
  }
  
  // Check file extension
  const ext = path.extname(imagePath).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
}

// Create integrity information object
export function createIntegrityInfo(
  buffer: Buffer, 
  mimeType: string, 
  uploadPreserved = true
): IntegrityInfo {
  return {
    original_size: buffer.length,
    original_checksum: generateImageChecksum(buffer),
    mime_type: mimeType,
    upload_preserved: uploadPreserved
  };
}

// Verify image integrity by comparing checksums
export function verifyImageIntegrity(
  originalChecksum: string, 
  processedBuffer: Buffer
): boolean {
  const processedChecksum = generateImageChecksum(processedBuffer);
  return originalChecksum === processedChecksum;
}