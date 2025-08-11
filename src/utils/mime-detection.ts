// MIME type detection utilities for ORBIT Gemini Image Analysis MCP

import path from 'path';

// Helper function to detect MIME type from file extension or buffer
export function detectMimeType(uploadPath: string, buffer?: Buffer): string {
  const ext = path.extname(uploadPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  };
  
  // First try extension-based detection
  if (mimeMap[ext]) {
    return mimeMap[ext];
  }
  
  // Fallback to buffer signature detection if available
  if (buffer && buffer.length >= 4) {
    const signature = buffer.subarray(0, 4);
    // PNG signature: 89 50 4E 47
    if (signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47) {
      return 'image/png';
    }
    // JPEG signature: FF D8 FF
    if (signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF) {
      return 'image/jpeg';
    }
    // WebP signature: 52 49 46 46 (RIFF)
    if (signature[0] === 0x52 && signature[1] === 0x49 && signature[2] === 0x46 && signature[3] === 0x46) {
      return 'image/webp';
    }
  }
  
  // Default fallback
  return 'image/jpeg';
}

// Helper function to determine MIME type from file path (legacy compatibility)
export function getMimeType(filePath: string): string {
  return detectMimeType(filePath);
}