# AI Image Analysis MCP - Debug Guide

## Overview
This guide helps debug issues with the AI Image Analysis MCP server, particularly when analyzing images that should be classified as lifestyle images.

## Project Structure
```
ai-image-analysis-mcp/
├── src/
│   ├── index.ts                    # Main MCP server entry point
│   ├── modules/
│   │   ├── gemini-analysis.ts      # Core Gemini analysis logic
│   │   ├── security.ts             # Security & rate limiting
│   │   ├── integrity.ts            # Image integrity validation
│   │   └── types.ts                # Type definitions
│   └── utils/
│       ├── error-handling.ts       # Error handling utilities
│       ├── mime-detection.ts       # MIME type detection
│       └── url-fetcher.ts          # URL fetching utilities
├── dist/                           # Compiled JavaScript
├── debug-test.js                   # Debug test script
└── setup-debug-env.sh             # Environment setup script
```

## Common Issues and Solutions

### 1. Environment Variables
**Problem**: Missing or incorrect environment variables
**Solution**: 
```bash
# Check environment variables
./setup-debug-env.sh

# Or set manually:
export GEMINI_API_KEY="your_gemini_api_key_here"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your_service_role_key_here"
```

### 2. Image Classification Issues
**Problem**: Images being classified as "product" instead of "lifestyle"
**Location**: `src/modules/gemini-analysis.ts` lines 234-250
**Debug Steps**:
1. Check the classification prompt (line 234)
2. Review Gemini model response (line 247)
3. Test with forced analysis type

### 3. Claude Desktop Config Mismatch
**Problem**: Configuration points to wrong path
**Current Config**: `/path/to/wrong-project/dist/index.js`
**Should Be**: `/path/to/ai-image-analysis-mcp/dist/index.js`

**Fix**: Update `claude-desktop-config.json`:
```json
{
  "mcpServers": {
    "orbit-gemini-analysis": {
      "command": "node",
      "args": ["/path/to/ai-image-analysis-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your_gemini_api_key_here",
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_KEY": "your_service_role_key_here",
        "NODE_ENV": "development"
      }
    }
  }
}
```

## Debug Tools

### 1. Direct Testing
```bash
# Run debug test with specific image
node debug-test.js

# This will:
# - Test auto-detection classification
# - Test forced lifestyle analysis
# - Show detailed analysis results
# - Display security scan results
# - Show audit log entries
```

### 2. HTTP Examples
```bash
# Run HTTP client examples
node examples/direct-http-examples.js

# This will:
# - Test Supabase deployment
# - Analyze images via HTTP
# - Test batch processing
# - Show server status
```

### 3. MCP Server Direct Run
```bash
# Start MCP server directly
npm run start

# Or with debug output
DEBUG=* npm run start
```

## Key Files to Check

### 1. Main Server (`src/index.ts`)
- Line 142: `handleAnalyzeImage` function
- Line 195: Call to `analyzeImageWithGemini`
- Error handling around line 210

### 2. Gemini Analysis (`src/modules/gemini-analysis.ts`)
- Line 17: `getLifestyleAnalysisPrompt()` - lifestyle analysis prompt
- Line 234: Classification logic for auto-detection
- Line 266: Main Gemini API call
- Line 299: JSON response parsing

### 3. Security Module (`src/modules/security.ts`)
- Line 14: `SECURITY_CONFIG` - file size limits, MIME types
- Line 155: `auditRequest` - logging function
- Rate limiting logic around line 115

## Testing Your Specific Image

Your test image should be classified as lifestyle. To debug:

1. **Check Image Properties**:
   ```bash
   file "/path/to/your/image.png"
   ls -lh "/path/to/your/image.png"
   ```

2. **Test Classification**:
   ```bash
   node debug-test.js
   ```

3. **Check Gemini Response**:
   - Look for classification prompt response
   - Verify it returns "lifestyle" not "product"
   - Check if analysis follows lifestyle schema

## Common Error Messages

### "GEMINI_API_KEY environment variable is required"
- Set the environment variable: `export GEMINI_API_KEY="your_key"`

### "File size exceeds maximum allowed size"
- Check `SECURITY_CONFIG.MAX_FILE_SIZE` in `src/modules/security.ts`
- Default is 10MB

### "Unsupported file type"
- Check `SECURITY_CONFIG.ALLOWED_MIME_TYPES` in `src/modules/security.ts`
- Supported: jpeg, jpg, png, webp

### "Failed to parse Gemini response"
- Gemini may return malformed JSON
- Check response parsing logic in `src/modules/gemini-analysis.ts` line 299

## Performance Monitoring

The server includes built-in monitoring:
- Request audit log
- Rate limiting
- Security scanning
- Processing time tracking

Check via:
```bash
# Get security status through MCP
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_security_status","arguments":{}}}'
```

## Advanced Debugging

### 1. Enable Verbose Logging
Add to `src/modules/gemini-analysis.ts`:
```javascript
console.log('Classification prompt:', classificationPrompt);
console.log('Classification response:', classificationText);
console.log('Analysis prompt:', sanitizedPrompt);
console.log('Raw Gemini response:', analysisText);
```

### 2. Test Different Models
Change model in `src/modules/gemini-analysis.ts` line 201:
```javascript
model: "gemini-1.5-pro",  // or "gemini-1.5-flash"
```

### 3. Adjust Temperature
Lower temperature for more consistent results (line 203):
```javascript
temperature: 0.05,  // Very low for consistency
```

## Next Steps

1. Run `debug-test.js` to test your specific image
2. Check the classification step specifically
3. If needed, modify the classification prompt to better distinguish lifestyle vs product
4. Update Claude desktop config to point to correct path
5. Test with the corrected configuration

The debug tools provided should help identify exactly where the issue occurs in the analysis pipeline.