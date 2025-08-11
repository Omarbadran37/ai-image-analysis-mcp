# Troubleshooting Guide for AI Image Analysis MCP

## Quick Diagnosis Steps

### 1. Environment Check
```bash
# Run setup script
./setup-debug-env.sh
```

### 2. Test Image Classification
```bash
# Test just the classification step
GEMINI_API_KEY=your_key node test-classification.js
```

### 3. Full Analysis Test
```bash
# Test complete analysis pipeline
GEMINI_API_KEY=your_key node debug-test.js
```

### 4. Check MCP Server Path
Verify your `claude-desktop-config.json` points to the correct path:
```
/path/to/ai-image-analysis-mcp/dist/index.js
```

## Common Issues & Solutions

### Issue 1: Wrong Classification (Product instead of Lifestyle)
**Symptoms**: Image shows people/scene but gets classified as "product"
**Diagnosis**: Run `node test-classification.js`
**Solutions**:
1. **Update Classification Prompt** (in `src/modules/gemini-analysis.ts` line 234):
   ```javascript
   const classificationPrompt = `Analyze this image and determine if it should be classified as:
   - "lifestyle": Shows people, activities, scenes, social situations, environments, or experiences
   - "product": Shows individual items, objects, or merchandise as the primary focus
   
   Even if products are present, if there are people interacting with them or using them in a scene, classify as "lifestyle".
   
   Respond with only the word "lifestyle" or "product".`;
   ```

2. **Force Lifestyle Analysis** (bypass auto-detection):
   ```javascript
   // In src/modules/gemini-analysis.ts, comment out lines 231-250 and set:
   const analysisType = forceType || 'lifestyle';
   ```

### Issue 2: Environment Variables Not Set
**Symptoms**: "GEMINI_API_KEY environment variable is required"
**Solution**: 
```bash
export GEMINI_API_KEY="your_actual_api_key"
# Test: echo $GEMINI_API_KEY
```

### Issue 3: File Path Issues
**Symptoms**: MCP server not starting or file not found
**Solution**: 
1. Check paths in `claude-desktop-config.json`
2. Ensure project is built: `npm run build`
3. Verify file exists: `ls -la /path/to/ai-image-analysis-mcp/dist/index.js`

### Issue 4: Image Not Found
**Symptoms**: "No such file or directory"
**Solution**: 
1. Verify image path: `ls -la "/path/to/your/image.png"`
2. Check file permissions: `file "/path/to/your/image.png"`

### Issue 5: Gemini API Issues
**Symptoms**: API errors, quota exceeded, authentication failed
**Diagnosis**: Check API key validity and quota at https://makersuite.google.com/
**Solutions**:
1. Verify API key is active
2. Check quota limits
3. Try different model (change line 201 in `src/modules/gemini-analysis.ts`)

## Manual Testing Commands

### Test 1: Basic Environment
```bash
cd /path/to/ai-image-analysis-mcp
npm run build
echo $GEMINI_API_KEY
```

### Test 2: Classification Only
```bash
GEMINI_API_KEY=your_key node test-classification.js
```

### Test 3: Full Pipeline
```bash
GEMINI_API_KEY=your_key node debug-test.js
```

### Test 4: MCP Server Direct
```bash
GEMINI_API_KEY=your_key npm run start
```

## Expected Results

For your image file:
- **Classification**: Should be "lifestyle" (contains people in social setting)
- **Analysis Type**: Should use lifestyle schema with scene_overview, human_elements, etc.
- **Confidence**: Should be > 0.8
- **Processing Time**: Should be < 5000ms

## Log Analysis

Check console output for:
- `[AUDIT] analyze_image: SUCCESS` - Request completed successfully
- `[AUDIT] analyze_image: FAILED` - Request failed, check error message
- Classification result in debug output
- Security scan results

## Next Steps If Still Failing

1. **Check Raw Gemini Response**: Add logging to see exact API responses
2. **Test Different Model**: Try `gemini-1.5-pro` instead of `gemini-2.0-flash-exp`
3. **Modify Classification Logic**: Update the classification prompt for better accuracy
4. **Force Analysis Type**: Skip auto-detection and use forced "lifestyle" type
5. **Update Claude Config**: Ensure MCP server path is correct

## Files to Modify

1. **Classification Prompt**: `/path/to/ai-image-analysis-mcp/src/modules/gemini-analysis.ts`
2. **Claude Config**: `/path/to/ai-image-analysis-mcp/claude-desktop-config.json`
3. **Security Settings**: `/path/to/ai-image-analysis-mcp/src/modules/security.ts`

Run `npm run build` after any changes to TypeScript files.