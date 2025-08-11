// Simple REST API wrapper functions for easy HTTP calls to Supabase MCP Server
// These provide a simplified interface for common operations

import { 
  SupabaseMCPClient, 
  createSupabaseMCPClientFromEnv,
  UploadToSupabaseParams 
} from './supabase-mcp-client.js';
import { promises as fs } from 'fs';

// Simple configuration interface
export interface APIConfig {
  supabaseUrl: string;
  anonKey: string;
  functionName?: string;
}

// Global client instance
let globalClient: SupabaseMCPClient | null = null;

/**
 * Initialize the API client with configuration
 */
export function initializeAPI(config: APIConfig) {
  globalClient = new SupabaseMCPClient(config);
  return globalClient;
}

/**
 * Initialize from environment variables
 */
export function initializeAPIFromEnv() {
  globalClient = createSupabaseMCPClientFromEnv();
  return globalClient;
}

/**
 * Get the current client instance
 */
function getClient(): SupabaseMCPClient {
  if (!globalClient) {
    throw new Error('API client not initialized. Call initializeAPI() or initializeAPIFromEnv() first.');
  }
  return globalClient;
}

/**
 * Simple function to analyze an image from file path
 */
export async function analyzeImageFile(
  imagePath: string, 
  options: {
    analysisType?: 'lifestyle' | 'product';
    uploadToStorage?: boolean;
    bucket?: string;
    storagePath?: string;
  } = {}
) {
  const client = getClient();
  
  try {
    // If uploading to storage first
    if (options.uploadToStorage && options.bucket && options.storagePath) {
      // Read file and convert to base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Data = imageBuffer.toString('base64');
      
      // Upload and analyze in one call
      return await client.uploadAndAnalyze(
        base64Data,
        options.bucket,
        options.storagePath,
        options.analysisType
      );
    } else {
      // Direct analysis (if MCP server supports local file access)
      return await client.analyzeImageFromPath(imagePath, options.analysisType);
    }
  } catch (error) {
    throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Simple function to analyze image from base64 data
 */
export async function analyzeImageData(
  base64Data: string,
  analysisType?: 'lifestyle' | 'product'
) {
  const client = getClient();
  return await client.analyzeImageFromBase64(base64Data, analysisType);
}

/**
 * Upload image file to Supabase Storage
 */
export async function uploadImage(
  imagePath: string,
  bucket: string,
  storagePath: string,
  metadata?: Record<string, any>
) {
  const client = getClient();
  
  try {
    // Read file and convert to base64
    const imageBuffer = await fs.readFile(imagePath);
    const base64Data = imageBuffer.toString('base64');
    
    const uploadParams: UploadToSupabaseParams = {
      image_data: base64Data,
      bucket,
      path: storagePath
    };
    if (metadata) {
      uploadParams.metadata = metadata;
    }
    return await client.uploadToSupabase(uploadParams);
  } catch (error) {
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get available analysis tools
 */
export async function getAvailableTools() {
  const client = getClient();
  return await client.listTools();
}

/**
 * Get server status and analytics
 */
export async function getServerStatus() {
  const client = getClient();
  return await client.getSecurityStatus();
}

/**
 * Get comprehensive server information
 */
export async function getServerInfo() {
  const client = getClient();
  return await client.getServerInfo();
}

/**
 * Health check - test if server is responsive
 */
export async function healthCheck(): Promise<{ healthy: boolean; error?: string }> {
  const client = getClient();
  
  try {
    const isHealthy = await client.healthCheck();
    return { healthy: isHealthy };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Batch analyze multiple images
 */
export async function analyzeImageBatch(
  images: Array<{
    path?: string;
    data?: string;
    analysisType?: 'lifestyle' | 'product';
    name: string;
  }>
) {
  const client = getClient();
  const results = [];
  
  for (const image of images) {
    try {
      let result;
      
      if (image.path) {
        // Read file if path provided
        const imageBuffer = await fs.readFile(image.path);
        const base64Data = imageBuffer.toString('base64');
        result = await client.analyzeImageFromBase64(base64Data, image.analysisType);
      } else if (image.data) {
        // Use provided base64 data
        result = await client.analyzeImageFromBase64(image.data, image.analysisType);
      } else {
        throw new Error('Either path or data must be provided');
      }
      
      results.push({
        name: image.name,
        success: true,
        result
      });
    } catch (error) {
      results.push({
        name: image.name,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

/**
 * Process and store image with analysis
 */
export async function processAndStoreImage(
  imagePath: string,
  bucket: string,
  storagePath: string,
  analysisType?: 'lifestyle' | 'product',
  metadata?: Record<string, any>
) {
  const client = getClient();
  
  try {
    // Read file and convert to base64
    const imageBuffer = await fs.readFile(imagePath);
    const base64Data = imageBuffer.toString('base64');
    
    // Upload and analyze in one operation
    const result = await client.uploadAndAnalyze(
      base64Data,
      bucket,
      storagePath,
      analysisType,
      metadata
    );
    
    return {
      success: true,
      upload_url: result.upload.public_url,
      analysis: result.analysis,
      processing_info: {
        file_size: imageBuffer.length,
        storage_path: `${bucket}/${storagePath}`,
        analysis_type: analysisType || 'auto-detected'
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Export the client class for advanced usage
export { SupabaseMCPClient } from './supabase-mcp-client.js';