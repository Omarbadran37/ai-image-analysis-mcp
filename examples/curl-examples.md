# cURL Examples for AI Image Analysis MCP Server

This document shows how to call the Supabase Edge Function MCP Server using raw HTTP requests with cURL.

## Prerequisites

Set your environment variables:
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your_anon_key_here"
export FUNCTION_NAME="ai-image-analysis-mcp"
```

## Basic MCP Protocol Structure

All requests use JSON-RPC 2.0 format:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method_name",
  "params": { ... }
}
```

## Example 1: List Available Tools

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "analyze_image",
        "description": "Securely analyze an image using Google Gemini AI...",
        "inputSchema": { ... }
      },
      {
        "name": "upload_to_supabase",
        "description": "Upload image or analysis results to Supabase Storage...",
        "inputSchema": { ... }
      },
      {
        "name": "get_security_status",
        "description": "Get current security configuration and audit information",
        "inputSchema": { ... }
      }
    ]
  }
}
```

## Example 2: Analyze Image from Base64 Data

First, convert your image to base64:
```bash
# Convert image to base64 (remove newlines)
IMAGE_BASE64=$(base64 -i /path/to/your/image.png | tr -d '\n')
```

Then analyze it:
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "analyze_image",
      "arguments": {
        "image_data": "'${IMAGE_BASE64}'",
        "analysis_type": "product"
      }
    }
  }'
```

## Example 3: Analyze Image from Supabase Storage

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "analyze_image",
      "arguments": {
        "image_path": "my-bucket/images/product.jpg",
        "analysis_type": "product"
      }
    }
  }'
```

## Example 4: Upload Image to Supabase Storage

```bash
# Convert image to base64
IMAGE_BASE64=$(base64 -i /path/to/your/image.png | tr -d '\n')

curl -X POST "${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "upload_to_supabase",
      "arguments": {
        "image_data": "'${IMAGE_BASE64}'",
        "bucket": "product-images",
        "path": "uploads/test-image.png",
        "metadata": {
          "source": "curl-example",
          "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
        }
      }
    }
  }'
```

## Example 5: Get Security Status

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "get_security_status",
      "arguments": {}
    }
  }'
```

## Example 6: Batch Processing Script

Create a script to process multiple images:

```bash
#!/bin/bash
# batch-analyze.sh

IMAGES_DIR="/path/to/images"
ANALYSIS_TYPE="product"

for image in "${IMAGES_DIR}"/*.{jpg,png,jpeg}; do
  if [[ -f "$image" ]]; then
    echo "Processing: $(basename "$image")"
    
    # Convert to base64
    IMAGE_BASE64=$(base64 -i "$image" | tr -d '\n')
    
    # Analyze
    curl -s -X POST "${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "jsonrpc": "2.0",
        "id": '$(date +%s)',
        "method": "tools/call",
        "params": {
          "name": "analyze_image",
          "arguments": {
            "image_data": "'${IMAGE_BASE64}'",
            "analysis_type": "'${ANALYSIS_TYPE}'"
          }
        }
      }' | jq '.result.content[0].text | fromjson | {analysis_type, confidence, metadata}'
    
    echo "---"
  fi
done
```

## Example 7: Health Check

Simple health check to verify the server is responding:

```bash
curl -s -X POST "${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 999,
    "method": "tools/list"
  }' | jq -r 'if .result.tools | length > 0 then "✅ Server is healthy" else "❌ Server is not responding" end'
```

## Error Handling

If you get errors, check the response structure:

```bash
# Save response to file for debugging
curl -X POST "${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }' \
  -o response.json

# Check for errors
jq '.error' response.json
```

## Common Error Responses

**Authentication Error:**
```json
{
  "message": "Invalid API key"
}
```

**MCP Protocol Error:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found: invalid_method"
  }
}
```

**Tool Execution Error:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "GEMINI_API_KEY not configured"
  }
}
```

## Tips

1. **Use jq for JSON processing**: `| jq '.result.content[0].text | fromjson'`
2. **Set timeouts for large images**: `--connect-timeout 30 --max-time 120`
3. **Save responses for debugging**: `-o response.json`
4. **Check HTTP status codes**: `-w "%{http_code}"`
5. **Use environment variables**: Store sensitive data in env vars, not command line