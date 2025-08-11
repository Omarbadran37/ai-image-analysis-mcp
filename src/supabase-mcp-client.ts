// Direct HTTP Client for calling Supabase Edge Functions as MCP Servers
// This allows you to call the MCP server directly via HTTP without the stdio proxy

export interface SupabaseMCPConfig {
  supabaseUrl: string;
  anonKey: string;
  functionName?: string;
}

export interface MCPRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface AnalyzeImageParams {
  image_path?: string;
  image_data?: string;
  analysis_type?: 'lifestyle' | 'product';
}

export interface UploadToSupabaseParams {
  image_data: string;
  bucket: string;
  path: string;
  metadata?: Record<string, any>;
}

export class SupabaseMCPClient {
  private config: SupabaseMCPConfig;
  private requestCounter = 0;

  constructor(config: SupabaseMCPConfig) {
    this.config = {
      functionName: 'orbit-mcp-server',
      ...config
    };
  }

  /**
   * Make a raw MCP request to the Supabase Edge Function
   */
  async makeRequest(method: string, params?: any): Promise<MCPResponse> {
    const mcpRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: ++this.requestCounter,
      method,
      params
    };

    const url = `${this.config.supabaseUrl}/functions/v1/${this.config.functionName}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.anonKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(mcpRequest)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: MCPResponse = await response.json();
    
    if (result.error) {
      throw new Error(`MCP Error ${result.error.code}: ${result.error.message}`);
    }

    return result;
  }

  /**
   * List available tools from the MCP server
   */
  async listTools() {
    const response = await this.makeRequest('tools/list');
    return response.result?.tools || [];
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, arguments_: Record<string, any>) {
    const response = await this.makeRequest('tools/call', {
      name,
      arguments: arguments_
    });
    
    // Extract the content from MCP response format
    const content = response.result?.content?.[0]?.text;
    if (content) {
      try {
        return JSON.parse(content);
      } catch {
        return { raw_content: content };
      }
    }
    
    return response.result;
  }

  /**
   * Analyze an image using the MCP server
   */
  async analyzeImage(params: AnalyzeImageParams) {
    return await this.callTool('analyze_image', params);
  }

  /**
   * Upload image data to Supabase Storage via the MCP server
   */
  async uploadToSupabase(params: UploadToSupabaseParams) {
    return await this.callTool('upload_to_supabase', params);
  }

  /**
   * Get security status from the MCP server
   */
  async getSecurityStatus() {
    return await this.callTool('get_security_status', {});
  }

  /**
   * Convenience method: Analyze image from file path
   */
  async analyzeImageFromPath(imagePath: string, analysisType?: 'lifestyle' | 'product') {
    const params: AnalyzeImageParams = { image_path: imagePath };
    if (analysisType) {
      params.analysis_type = analysisType;
    }
    return await this.analyzeImage(params);
  }

  /**
   * Convenience method: Analyze image from base64 data
   */
  async analyzeImageFromBase64(imageData: string, analysisType?: 'lifestyle' | 'product') {
    const params: AnalyzeImageParams = { image_data: imageData };
    if (analysisType) {
      params.analysis_type = analysisType;
    }
    return await this.analyzeImage(params);
  }

  /**
   * Convenience method: Upload and analyze image in one call
   */
  async uploadAndAnalyze(
    imageData: string,
    bucket: string,
    path: string,
    analysisType?: 'lifestyle' | 'product',
    metadata?: Record<string, any>
  ) {
    // First upload the image
    const uploadParams: UploadToSupabaseParams = {
      image_data: imageData,
      bucket,
      path
    };
    if (metadata) {
      uploadParams.metadata = metadata;
    }
    const uploadResult = await this.uploadToSupabase(uploadParams);

    // Then analyze it using the uploaded path
    const analysisParams: AnalyzeImageParams = {
      image_path: `${bucket}/${path}`
    };
    if (analysisType) {
      analysisParams.analysis_type = analysisType;
    }
    const analysisResult = await this.analyzeImage(analysisParams);

    return {
      upload: uploadResult,
      analysis: analysisResult
    };
  }

  /**
   * Get analytics and statistics from the MCP server database
   */
  async getAnalytics(timeWindow = '24 hours') {
    // This would require a custom tool in the edge function for analytics
    return await this.callTool('get_analytics', { time_window: timeWindow });
  }

  /**
   * Health check - verify the MCP server is responding
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.listTools();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get server information and capabilities
   */
  async getServerInfo() {
    const tools = await this.listTools();
    const status = await this.getSecurityStatus();
    
    return {
      tools: tools.map((t: any) => t.name),
      server_info: status.server_info,
      security_config: status.security_config,
      endpoint: `${this.config.supabaseUrl}/functions/v1/${this.config.functionName}`
    };
  }
}

/**
 * Factory function to create a configured MCP client
 */
export function createSupabaseMCPClient(config: SupabaseMCPConfig): SupabaseMCPClient {
  return new SupabaseMCPClient(config);
}

/**
 * Create client from environment variables
 */
export function createSupabaseMCPClientFromEnv(): SupabaseMCPClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const functionName = process.env.SUPABASE_FUNCTION_NAME;

  if (!supabaseUrl || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  }

  const config: SupabaseMCPConfig = { supabaseUrl, anonKey };
  if (functionName) {
    config.functionName = functionName;
  }

  return new SupabaseMCPClient(config);
}