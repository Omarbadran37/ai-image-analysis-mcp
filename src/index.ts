#!/usr/bin/env node

// AI Image Analysis MCP v2.0 - Modular Architecture
// Main server entry point with clean separation of concerns

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import crypto from 'crypto';

// Import modular components
import { 
  SECURITY_CONFIG, 
  generateSecureHash, 
  checkRateLimit, 
  auditRequest,
  getAuditLog,
  getRateLimitStoreSize
} from './modules/security.js';
import { analyzeImageWithGemini } from './modules/gemini-analysis.js';
import { uploadToSupabase } from './modules/supabase-upload.js';
import { SecurityStatusResponse, AnalysisType } from './modules/types.js';
import { getErrorMessage } from './utils/error-handling.js';

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
            image_url: {
              type: 'string',
              description: 'URL to fetch the image from (https/http only)',
              format: 'uri',
              maxLength: 2000
            },
            analysis_type: { 
              type: 'string', 
              enum: ['lifestyle', 'product'], 
              description: 'Force specific analysis type (optional)' 
            }
          },
          required: [],
          additionalProperties: false,
          oneOf: [
            { required: ['image_path'] },
            { required: ['image_url'] }
          ]
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

// Main request handler with security and modular dispatch
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
      case 'analyze_image':
        return await handleAnalyzeImage(args, requestId, startTime);
      
      case 'upload_to_supabase':
        return await handleSupabaseUpload(args, requestId, startTime);
      
      case 'get_security_status':
        return await handleSecurityStatus();
      
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

// Handler for image analysis
async function handleAnalyzeImage(args: any, requestId: string, startTime: number) {
  const { image_path, image_url, analysis_type } = args as { 
    image_path?: string; 
    image_url?: string;
    analysis_type?: AnalysisType 
  };
  
  // Input validation - exactly one of image_path or image_url must be provided
  if (!image_path && !image_url) {
    throw new Error('Either image_path or image_url parameter is required');
  }
  
  if (image_path && image_url) {
    throw new Error('Cannot specify both image_path and image_url parameters');
  }
  
  if (image_path && typeof image_path !== 'string') {
    throw new Error('Invalid image_path parameter');
  }
  
  if (image_url && typeof image_url !== 'string') {
    throw new Error('Invalid image_url parameter');
  }
  
  const inputHash = generateSecureHash(JSON.stringify({ image_path, image_url, analysis_type }));
  
  try {
    const result = await analyzeImageWithGemini(image_path, analysis_type, image_url);
    auditRequest('analyze_image', true, inputHash);
    
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
    auditRequest('analyze_image', false, inputHash, getErrorMessage(error));
    throw error;
  }
}

// Handler for Supabase upload
async function handleSupabaseUpload(args: any, requestId: string, startTime: number) {
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

  const inputHash = generateSecureHash(JSON.stringify({ 
    bucket, 
    path, 
    supabase_url, 
    metadata_keys: metadata ? Object.keys(metadata) : [] 
  }));

  try {
    const result = await uploadToSupabase(image_data, bucket, path, supabase_url, supabase_key, metadata);
    auditRequest('upload_to_supabase', true, inputHash);

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
    auditRequest('upload_to_supabase', false, inputHash, getErrorMessage(error));
    throw error;
  }
}

// Handler for security status
async function handleSecurityStatus() {
  const auditLog = getAuditLog();
  const securityStatus: SecurityStatusResponse = {
    security_config: SECURITY_CONFIG,
    rate_limit_status: {
      active_limits: getRateLimitStoreSize(),
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AI Image Analysis MCP Server v2.0 running on stdio');
}

main().catch((error) => {
  console.error('Failed to start server:', getErrorMessage(error));
  process.exit(1);
});