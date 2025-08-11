#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { URL } from 'url';

// Security Configuration
const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  MAX_PROMPT_LENGTH: 10000,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 30,
  ENABLE_PII_DETECTION: true,
  BLOCK_SUSPICIOUS_PATTERNS: true
};

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Request audit log
interface AuditEntry {
  timestamp: number;
  toolName: string;
  success: boolean;
  error?: string | undefined;
  inputHash: string;
  userId?: string;
  ipAddress?: string;
}

const auditLog: AuditEntry[] = [];

// Type guard for error objects
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Type guard for objects with message property
function hasMessage(error: unknown): error is { message: string } {
  return typeof error === 'object' && error !== null && 'message' in error;
}

// Safe error message extraction
function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (hasMessage(error)) return error.message;
  return String(error);
}

// Security utility functions
function generateSecureHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function sanitizeInput(input: string): string {
  // Remove potential HTML/script tags
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .substring(0, SECURITY_CONFIG.MAX_PROMPT_LENGTH);
}

function detectPromptInjection(input: string): { detected: boolean; confidence: number; patterns: string[] } {
  const injectionPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /forget\s+(all\s+)?(previous\s+)?instructions/i,
    /system\s*:\s*you\s+are\s+now/i,
    /\[system\]/i,
    /developer\s+mode/i,
    /jailbreak/i,
    /prompt\s+injection/i,
    /override\s+safety/i,
    /<script.*?>.*?<\/script>/i,
    /javascript\s*:/i,
    /data\s*:\s*text\/html/i
  ];

  const detectedPatterns: string[] = [];
  let score = 0;

  for (const pattern of injectionPatterns) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.toString());
      score++;
    }
  }

  // Check for base64 encoded content
  const base64Pattern = /(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)/;
  if (base64Pattern.test(input)) {
    try {
      const decoded = Buffer.from(input.match(base64Pattern)?.[0] || '', 'base64').toString();
      const recursiveCheck = detectPromptInjection(decoded);
      if (recursiveCheck.detected) {
        detectedPatterns.push('base64_encoded_injection');
        score += 2;
      }
    } catch {
      // Ignore invalid base64
    }
  }

  const confidence = Math.min(score / injectionPatterns.length, 1);
  return {
    detected: confidence > 0.3,
    confidence,
    patterns: detectedPatterns
  };
}

function detectPII(text: string): { detected: boolean; types: string[] } {
  const piiPatterns = {
    ssn: /\b\d{3}-\d{2}-\d{4}\b/,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    phone: /\b\d{3}-\d{3}-\d{4}\b/,
    creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/
  };

  const detectedTypes: string[] = [];
  
  for (const [type, pattern] of Object.entries(piiPatterns)) {
    if (pattern.test(text)) {
      detectedTypes.push(type);
    }
  }

  return {
    detected: detectedTypes.length > 0,
    types: detectedTypes
  };
}

function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = identifier;
  const window = rateLimitStore.get(key);

  if (!window || now > window.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + SECURITY_CONFIG.RATE_LIMIT_WINDOW
    });
    return { allowed: true };
  }

  if (window.count >= SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((window.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  window.count++;
  rateLimitStore.set(key, window);
  return { allowed: true };
}

function validateImagePath(imagePath: string): boolean {
  // Prevent directory traversal
  if (imagePath.includes('..') || imagePath.includes('~')) {
    return false;
  }
  
  // Check file extension
  const ext = path.extname(imagePath).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
}

function auditRequest(toolName: string, success: boolean, inputHash: string, error?: string) {
  const entry: AuditEntry = {
    timestamp: Date.now(),
    toolName,
    success,
    inputHash,
    error: error || undefined
  };
  
  auditLog.push(entry);
  
  // Keep only last 1000 entries
  if (auditLog.length > 1000) {
    auditLog.shift();
  }

  // Log to console for debugging
  console.error(`[AUDIT] ${toolName}: ${success ? 'SUCCESS' : 'FAILED'} - ${inputHash}${error ? ` - ${error}` : ''}`);
}

// Helper function to determine MIME type
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  };
  return mimeMap[ext] || 'image/jpeg';
}

// Gemini AI integration with security enhancements
async function analyzeImageWithGemini(imagePath: string, forceType?: 'lifestyle' | 'product') {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  // Security validations
  if (!validateImagePath(imagePath)) {
    throw new Error('Invalid image path or potential security risk detected');
  }

  try {
    // Check file size
    const stats = await fs.stat(imagePath);
    if (stats.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${SECURITY_CONFIG.MAX_FILE_SIZE} bytes`);
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1, // Lower temperature for more consistent analysis
        topK: 32,
        topP: 1,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    // Read and encode image
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Detect MIME type
    const mimeType = getMimeType(imagePath);
    if (!SECURITY_CONFIG.ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
    
    // Determine analysis type (auto-detect or forced)
    let analysisType = forceType;
    if (!analysisType) {
      // Simple auto-detection based on filename or could be enhanced with a quick AI classification
      analysisType = imagePath.toLowerCase().includes('lifestyle') ? 'lifestyle' : 'product';
    }

    // Choose appropriate prompt based on type with security validation
    const rawPrompt = analysisType === 'lifestyle' 
      ? getLifestyleAnalysisPrompt()
      : getProductAnalysisPrompt();
    
    // Security check on prompt
    const injectionCheck = detectPromptInjection(rawPrompt);
    if (injectionCheck.detected) {
      throw new Error(`Prompt injection detected with confidence: ${injectionCheck.confidence}`);
    }
    
    const sanitizedPrompt = sanitizeInput(rawPrompt);

    // Generate content with image
    const result = await model.generateContent([
      sanitizedPrompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);

    const response = await result.response;
    const analysisText = response.text();
    
    // Security check on response
    if (SECURITY_CONFIG.ENABLE_PII_DETECTION) {
      const piiCheck = detectPII(analysisText);
      if (piiCheck.detected) {
        console.warn(`PII detected in response: ${piiCheck.types.join(', ')}`);
        // Log but don't block - might be false positive in image analysis
      }
    }
    
    // Parse JSON response with enhanced error handling
    let analysisJson;
    try {
      // Extract JSON from the response (remove markdown formatting if present)
      const jsonMatch = analysisText.match(/```json\n(.*?)\n```/s) || analysisText.match(/\{.*\}/s);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : analysisText;
      
      // Validate JSON structure before parsing
      if (!jsonText || jsonText.trim().length === 0) {
        throw new Error('Empty response from Gemini');
      }
      
      analysisJson = JSON.parse(jsonText);
      
      // Basic structure validation
      if (typeof analysisJson !== 'object' || analysisJson === null) {
        throw new Error('Invalid response structure from Gemini');
      }
      
    } catch (parseError) {
      throw new Error(`Failed to parse Gemini response: ${getErrorMessage(parseError)}`);
    }

    return {
      analysis_type: analysisType,
      confidence: 0.9,
      metadata: analysisJson,
      processing_time_ms: Date.now(),
      security_scan: {
        prompt_injection_detected: false,
        pii_detected: SECURITY_CONFIG.ENABLE_PII_DETECTION ? detectPII(analysisText).detected : false,
        file_validated: true
      }
    };
  } catch (error) {
    throw new Error(`Gemini analysis failed: ${getErrorMessage(error)}`);
  }
}

// Lifestyle analysis prompt
function getLifestyleAnalysisPrompt(): string {
  return `Analyze this lifestyle image comprehensively and return results in JSON format. Examine the visual narrative, social dynamics, environmental context, and cultural significance while identifying key elements that establish the lifestyle portrayed. Structure your analysis according to the following JSON schema:

{
  "scene_overview": {
    "setting": "",
    "time_of_day": "",
    "season": "",
    "occasion": "",
    "primary_activity": ""
  },
  "human_elements": {
    "number_of_people": 0,
    "demographics": [],
    "interactions": "",
    "emotional_states": [],
    "clothing_style": "",
    "social_dynamics": ""
  },
  "environment": {
    "location_type": "",
    "architectural_elements": [],
    "natural_elements": [],
    "urban_context": "",
    "spatial_arrangement": ""
  },
  "key_objects": {
    "food_and_beverage": [],
    "technology": [],
    "furniture": [],
    "personal_items": [],
    "defining_props": []
  },
  "atmospheric_elements": {
    "lighting_quality": "",
    "color_palette": [],
    "mood": "",
    "sensory_cues": []
  },
  "narrative_analysis": {
    "story_implied": "",
    "lifestyle_values_represented": [],
    "cultural_significance": "",
    "socioeconomic_indicators": [],
    "historical_context": ""
  },
  "photographic_elements": {
    "composition": "",
    "focal_points": [],
    "perspective": "",
    "technical_qualities": []
  },
  "marketing_potential": {
    "target_demographic": "",
    "aspirational_elements": [],
    "brand_alignment_opportunities": [],
    "emotional_hooks": []
  }
}

Provide comprehensive but concise entries for each field based solely on what's visible in the image. Where information cannot be determined, use "indeterminate" rather than making assumptions.`;
}

// Product analysis prompt
function getProductAnalysisPrompt(): string {
  return `You are a specialized product image analyzer with expertise in design aesthetics, materials, construction methods, and commercial analysis. Analyze this product image to extract detailed metadata across multiple dimensions.

Return your analysis in the following JSON format:

{
  "product_identification": {
    "product_type": "",
    "product_category": "",
    "design_style": ""
  },
  "physical_characteristics": {
    "primary_color": "",
    "material": "",
    "pattern_type": "",
    "frame_design": "",
    "surface_texture": "",
    "backrest_style": "",
    "seat_profile": ""
  },
  "structural_elements": {
    "frame_type": "",
    "seat_support": "",
    "arm_design": "",
    "leg_structure": ""
  },
  "design_attributes": {
    "aesthetic_category": "",
    "visual_weight": "",
    "design_influence": "",
    "intended_setting": "",
    "design_cohesion": ""
  },
  "commercial_analysis": {
    "market_positioning": "",
    "target_market": [],
    "price_point_indication": "",
    "competitive_advantages": [],
    "market_differentiation": ""
  },
  "quality_assessment": {
    "construction_quality": "",
    "material_quality": "",
    "finish_quality": "",
    "durability_indicators": "",
    "craftsmanship_level": ""
  }
}

For each field, provide your assessment based on visual analysis. For any field you cannot determine with reasonable confidence, use "unknown" as the value.`;
}

// Helper function to detect MIME type from file extension or buffer
function detectMimeType(uploadPath: string, buffer?: Buffer): string {
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

// Generate integrity checksum for verification
function generateImageChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Secure Supabase upload function with image integrity preservation
async function uploadToSupabase(imageData: string, bucket: string, uploadPath: string, supabaseUrl: string, supabaseKey: string, metadata?: Record<string, any>) {
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

// MCP Server Setup with Security
const server = new Server(
  {
    name: 'orbit-gemini-image-analysis',
    version: '2.0.0',
    description: 'Secure AI-powered image analysis using Google Gemini with enhanced security features'
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool Registration with proper MCP SDK syntax
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'analyze_image',
        description: 'Securely analyze an image using Google Gemini AI with automatic type detection and security validations',
        inputSchema: {
          type: 'object',
          properties: {
            image_path: { 
              type: 'string', 
              description: 'Absolute path to the image file (jpg, png, webp only)',
              maxLength: 500
            },
            analysis_type: { 
              type: 'string', 
              enum: ['lifestyle', 'product'], 
              description: 'Force specific analysis type (optional)' 
            }
          },
          required: ['image_path'],
          additionalProperties: false
        }
      },
      {
        name: 'upload_to_supabase',
        description: 'Upload image or analysis results to Supabase Storage with security validation',
        inputSchema: {
          type: 'object',
          properties: {
            image_data: { 
              type: 'string', 
              description: 'Base64 encoded image data',
              maxLength: 20000000 // ~15MB base64
            },
            bucket: { 
              type: 'string', 
              description: 'Supabase bucket name',
              maxLength: 100
            },
            path: { 
              type: 'string', 
              description: 'Storage path within bucket',
              maxLength: 300
            },
            supabase_url: { 
              type: 'string', 
              description: 'Supabase project URL',
              format: 'uri'
            },
            supabase_key: { 
              type: 'string', 
              description: 'Supabase service role key',
              minLength: 20
            },
            metadata: { 
              type: 'object', 
              description: 'Additional metadata to store with the file (optional)'
            }
          },
          required: ['image_data', 'bucket', 'path', 'supabase_url', 'supabase_key'],
          additionalProperties: false
        }
      },
      {
        name: 'get_security_status',
        description: 'Get current security configuration and audit information',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  // Rate limiting check
  const rateLimitCheck = checkRateLimit('global');
  if (!rateLimitCheck.allowed) {
    auditRequest(name, false, generateSecureHash(JSON.stringify(args)), `Rate limit exceeded. Retry after ${rateLimitCheck.retryAfter}s`);
    throw new Error(`Rate limit exceeded. Please try again in ${rateLimitCheck.retryAfter} seconds.`);
  }

  try {
    switch (name) {
      case 'analyze_image': {
        const { image_path, analysis_type } = args as { image_path: string; analysis_type?: 'lifestyle' | 'product' };
        
        // Input validation
        if (!image_path || typeof image_path !== 'string') {
          throw new Error('Invalid image_path parameter');
        }
        
        const inputHash = generateSecureHash(JSON.stringify({ image_path, analysis_type }));
        
        try {
          const result = await analyzeImageWithGemini(image_path, analysis_type);
          auditRequest(name, true, inputHash);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  ...result,
                  request_id: requestId,
                  processing_time: Date.now() - startTime
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          auditRequest(name, false, inputHash, getErrorMessage(error));
          throw error;
        }
      }

      case 'upload_to_supabase': {
        const {
          image_data,
          bucket,
          path,
          supabase_url,
          supabase_key,
          metadata
        } = args as {
          image_data: string;
          bucket: string;
          path: string;
          supabase_url: string;
          supabase_key: string;
          metadata?: Record<string, any>;
        };

        // Input validation
        if (!image_data || typeof image_data !== 'string') {
          throw new Error('Invalid image_data parameter');
        }
        if (!bucket || typeof bucket !== 'string') {
          throw new Error('Invalid bucket parameter');
        }
        if (!path || typeof path !== 'string') {
          throw new Error('Invalid path parameter');
        }
        if (!supabase_url || typeof supabase_url !== 'string') {
          throw new Error('Invalid supabase_url parameter');
        }
        if (!supabase_key || typeof supabase_key !== 'string') {
          throw new Error('Invalid supabase_key parameter');
        }

        const inputHash = generateSecureHash(JSON.stringify({ bucket, path, supabase_url, metadata_keys: metadata ? Object.keys(metadata) : [] }));

        try {
          const result = await uploadToSupabase(image_data, bucket, path, supabase_url, supabase_key, metadata);
          auditRequest(name, true, inputHash);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  ...result,
                  request_id: requestId,
                  processing_time: Date.now() - startTime
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          auditRequest(name, false, inputHash, getErrorMessage(error));
          throw error;
        }
      }

      case 'get_security_status': {
        const securityStatus = {
          security_config: SECURITY_CONFIG,
          rate_limit_status: {
            active_limits: rateLimitStore.size,
            current_window: SECURITY_CONFIG.RATE_LIMIT_WINDOW
          },
          audit_log: {
            total_entries: auditLog.length,
            recent_entries: auditLog.slice(-10).map(entry => ({
              timestamp: new Date(entry.timestamp).toISOString(),
              tool: entry.toolName,
              success: entry.success,
              error: entry.error || 'none'
            }))
          },
          server_info: {
            name: 'orbit-gemini-image-analysis',
            version: '2.0.0',
            uptime: process.uptime(),
            node_version: process.version
          }
        };
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(securityStatus, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${getErrorMessage(error)}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ORBIT Gemini Image Analysis MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Failed to start server:', getErrorMessage(error));
  process.exit(1);
});