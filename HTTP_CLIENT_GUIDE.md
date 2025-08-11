# Direct HTTP Client Guide for Supabase MCP Server

## 🎯 Overview

You now have **multiple ways** to call your Supabase Edge Function MCP Server directly via HTTP, in addition to the MCP proxy for Claude Desktop.

## 🌐 All Available Methods

### **1. Claude Desktop (MCP Proxy)**
```
Claude Desktop ↔ stdio ↔ MCP Proxy ↔ HTTP ↔ Supabase Edge Function
```

### **2. TypeScript/JavaScript HTTP Client**
```javascript
import { createSupabaseMCPClient } from './dist/supabase-mcp-client.js';

const client = createSupabaseMCPClient({
  supabaseUrl: 'https://your-project.supabase.co',
  anonKey: 'your_anon_key_here'
});

const result = await client.analyzeImageFromBase64(base64Data, 'product');
```

### **3. Simple API Wrapper**
```javascript
import { initializeAPIFromEnv, analyzeImageFile } from './dist/api-client.js';

initializeAPIFromEnv();
const result = await analyzeImageFile('/path/to/image.jpg', {
  analysisType: 'product',
  uploadToStorage: true,
  bucket: 'my-bucket',
  storagePath: 'analyzed/image.jpg'
});
```

### **4. Raw HTTP/cURL**
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/ai-image-analysis-mcp" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "analyze_image",
      "arguments": {
        "image_data": "base64_encoded_image_data",
        "analysis_type": "product"
      }
    }
  }'
```

### **5. Web Application (Browser)**
- Complete HTML/JavaScript example provided
- Drag-and-drop image upload
- Real-time analysis results
- Works in any modern browser

## 📁 Available Files

### **Core HTTP Client**
- `src/supabase-mcp-client.ts` - Full-featured HTTP client
- `src/api-client.ts` - Simple wrapper functions
- `dist/supabase-mcp-client.js` - Compiled client (importable)
- `dist/api-client.js` - Compiled wrapper (importable)

### **Examples & Documentation**
- `examples/direct-http-examples.js` - Node.js usage examples
- `examples/web-app-example.html` - Complete web interface
- `examples/curl-examples.md` - Command-line examples
- `HTTP_CLIENT_GUIDE.md` - This guide

### **MCP Proxy (for Claude Desktop)**
- `src/mcp-supabase-proxy.ts` - MCP-to-HTTP proxy
- `claude-desktop-config-supabase.json` - Configuration

## 🚀 Quick Start Examples

### **Node.js Script**
```javascript
#!/usr/bin/env node
import { createSupabaseMCPClientFromEnv } from './dist/supabase-mcp-client.js';

// Set environment variables:
// export SUPABASE_URL="https://your-project.supabase.co"
// export SUPABASE_ANON_KEY="your_anon_key_here"

const client = createSupabaseMCPClientFromEnv();

// Health check
const healthy = await client.healthCheck();
console.log('Server healthy:', healthy);

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools.map(t => t.name));

// Analyze image
const analysis = await client.analyzeImageFromBase64(base64Data, 'product');
console.log('Analysis:', analysis.analysis_type, analysis.confidence);
```

### **Web Application**
```html
<script type="module">
import { createSupabaseMCPClient } from './dist/supabase-mcp-client.js';

const client = createSupabaseMCPClient({
  supabaseUrl: 'https://your-project.supabase.co',
  anonKey: 'your_anon_key_here'
});

// Analyze uploaded image
async function analyzeImage(file) {
  const base64 = await fileToBase64(file);
  const result = await client.analyzeImageFromBase64(base64, 'product');
  
  document.getElementById('results').innerHTML = `
    <h3>Analysis Complete</h3>
    <p>Type: ${result.analysis_type}</p>
    <p>Confidence: ${result.confidence}</p>
  `;
}
</script>
```

### **Python (using requests)**
```python
import requests
import base64

# Read and encode image
with open('image.jpg', 'rb') as f:
    image_data = base64.b64encode(f.read()).decode()

# Make request
response = requests.post(
    'https://your-project.supabase.co/functions/v1/orbit-mcp-server',
    headers={
        'Authorization': 'Bearer YOUR_ANON_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'tools/call',
        'params': {
            'name': 'analyze_image',
            'arguments': {
                'image_data': image_data,
                'analysis_type': 'product'
            }
        }
    }
)

result = response.json()
print(f"Analysis: {result['result']['content'][0]['text']}")
```

## 🔧 Available Operations

### **Image Analysis**
```javascript
// From base64 data
await client.analyzeImageFromBase64(base64Data, 'product');

// From Supabase Storage path
await client.analyzeImageFromPath('bucket/path/image.jpg', 'lifestyle');

// With generic parameters
await client.analyzeImage({
  image_data: base64Data,
  analysis_type: 'product'
});
```

### **File Upload**
```javascript
// Upload to Supabase Storage
await client.uploadToSupabase({
  image_data: base64Data,
  bucket: 'my-bucket',
  path: 'uploads/image.jpg',
  metadata: { source: 'web-app' }
});

// Upload and analyze in one call
await client.uploadAndAnalyze(
  base64Data,
  'my-bucket',
  'analyzed/image.jpg',
  'product',
  { timestamp: new Date().toISOString() }
);
```

### **Server Management**
```javascript
// Health check
const healthy = await client.healthCheck();

// Get server info
const info = await client.getServerInfo();

// Get security status
const status = await client.getSecurityStatus();

// List available tools
const tools = await client.listTools();
```

### **Batch Processing**
```javascript
import { analyzeImageBatch } from './dist/api-client.js';

const results = await analyzeImageBatch([
  { name: 'image1', path: '/path/to/image1.jpg', analysisType: 'product' },
  { name: 'image2', data: base64Data2, analysisType: 'lifestyle' }
]);
```

## 🔒 Authentication

All HTTP calls require your Supabase anonymous key:

```bash
# Environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your_anon_key_here"

# In code
const client = createSupabaseMCPClient({
  supabaseUrl: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY
});
```

## 📊 Response Format

All responses follow the MCP content format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text", 
        "text": "{\"analysis_type\":\"product\",\"confidence\":0.9,...}"
      }
    ]
  }
}
```

The HTTP client automatically parses this and returns the analysis object directly.

## 🎉 Benefits

✅ **Multiple interfaces**: Choose the best method for your use case
✅ **Same backend**: All methods use the same Supabase Edge Function
✅ **Full MCP compatibility**: Perfect JSON-RPC 2.0 implementation
✅ **Type safety**: Full TypeScript support with proper typing
✅ **Error handling**: Comprehensive error handling and validation
✅ **Easy integration**: Works with any HTTP client or programming language
✅ **Production ready**: Includes rate limiting, security, and monitoring

Now you can call your Supabase MCP server from **anywhere** - Claude Desktop, web apps, Node.js scripts, Python, cURL, or any HTTP client!