#!/usr/bin/env node

// MCP Proxy Server that forwards requests to Supabase Edge Functions
// This allows Claude Desktop to connect to Supabase as if it were a local MCP server

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getErrorMessage } from './utils/error-handling.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fetchImageAsBase64, validateUrl, sanitizeUrl } from './utils/url-fetcher.js';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  functionName: string;
}

class MCPSupabaseProxy {
  private config: SupabaseConfig;
  private requestCounter = 0;

  constructor(config: SupabaseConfig) {
    this.config = config;
  }

  async forwardMCPRequest(method: string, params?: any): Promise<any> {
    const mcpRequest = {
      jsonrpc: '2.0',
      id: ++this.requestCounter,
      method,
      params
    };

    const response = await fetch(`${this.config.url}/functions/v1/${this.config.functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.anonKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(mcpRequest)
    });

    if (!response.ok) {
      throw new Error(`Supabase request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }
}

// Load configuration from environment
function loadConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const functionName = process.env.SUPABASE_FUNCTION_NAME || 'orbit-mcp-server';

  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  }

  return { url, anonKey, functionName };
}

// Create MCP server that proxies to Supabase
async function createMCPProxy() {
  const config = loadConfig();
  const proxy = new MCPSupabaseProxy(config);

  const server = new Server(
    {
      name: 'orbit-gemini-analysis-proxy',
      version: '2.0.0',
      description: 'MCP Proxy to Supabase Edge Functions for AI Image Analysis'
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Forward tools/list requests
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      console.error('[PROXY] Forwarding tools/list to Supabase...');
      const result = await proxy.forwardMCPRequest('tools/list');
      console.error('[PROXY] Received tools list from Supabase');
      return result;
    } catch (error) {
      console.error('[PROXY] Error listing tools:', getErrorMessage(error));
      throw error;
    }
  });

  // Forward tools/call requests with file path and URL conversion
  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    try {
      const { name, arguments: args } = request.params;
      console.error(`[PROXY] Forwarding tool call '${name}' to Supabase...`);
      
      let processedArgs = { ...args };
      
      // Convert local file paths or URLs to base64 for analyze_image
      if (name === 'analyze_image' && !args.image_data) {
        
        if (args.image_path) {
          // Handle local file path
          console.error(`[PROXY] Converting local file to base64: ${args.image_path}`);
          
          try {
            // Validate file exists and is an image
            const imagePath = args.image_path;
            const ext = path.extname(imagePath).toLowerCase();
            
            if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
              throw new Error(`Unsupported file extension: ${ext}`);
            }
            
            // Read file and convert to base64
            const imageBuffer = await fs.readFile(imagePath);
            const base64Data = imageBuffer.toString('base64');
            
            console.error(`[PROXY] File converted to base64 (${imageBuffer.length} bytes)`);
            
            // Replace image_path with image_data
            processedArgs = {
              ...args,
              image_data: base64Data
            };
            delete processedArgs.image_path;
            
          } catch (fileError) {
            throw new Error(`Failed to load image: ${getErrorMessage(fileError)}`);
          }
          
        } else if (args.image_url) {
          // Handle URL
          console.error(`[PROXY] Fetching image from URL: ${args.image_url}`);
          
          try {
            // Validate and sanitize URL
            const sanitizedUrl = sanitizeUrl(args.image_url);
            const validation = validateUrl(sanitizedUrl);
            
            if (!validation.valid) {
              throw new Error(`URL validation failed: ${validation.error}`);
            }
            
            // Fetch image from URL
            const { base64, mimeType, size } = await fetchImageAsBase64(sanitizedUrl);
            
            console.error(`[PROXY] Image fetched from URL (${size} bytes, ${mimeType})`);
            
            // Replace image_url with image_data
            processedArgs = {
              ...args,
              image_data: base64
            };
            delete processedArgs.image_url;
            
          } catch (urlError) {
            throw new Error(`Failed to fetch image from URL: ${getErrorMessage(urlError)}`);
          }
        }
      }
      
      const result = await proxy.forwardMCPRequest('tools/call', {
        name,
        arguments: processedArgs
      });
      
      console.error(`[PROXY] Received response for '${name}' from Supabase`);
      return result;
    } catch (error) {
      console.error('[PROXY] Error calling tool:', getErrorMessage(error));
      return {
        content: [
          {
            type: 'text',
            text: `Proxy Error: ${getErrorMessage(error)}`
          }
        ],
        isError: true
      };
    }
  });

  return server;
}

// Start the proxy server
async function main() {
  try {
    console.error('🔄 Starting AI Image Analysis MCP → Supabase Proxy Server...');
    
    const server = await createMCPProxy();
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    
    console.error('✅ AI Image Analysis MCP Proxy Server running on stdio');
    console.error('🌐 Forwarding requests to Supabase Edge Functions');
    console.error(`📡 Target: ${process.env.SUPABASE_URL}/functions/v1/${process.env.SUPABASE_FUNCTION_NAME || 'orbit-mcp-server'}`);
    
  } catch (error) {
    console.error('❌ Failed to start proxy server:', getErrorMessage(error));
    console.error('💡 Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set in your environment');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('💥 Unexpected error:', getErrorMessage(error));
  process.exit(1);
});