#!/usr/bin/env node

// Examples of calling the Supabase MCP Server directly via HTTP
// Run with: node examples/direct-http-examples.js

import { promises as fs } from 'fs';
import { 
  initializeAPIFromEnv, 
  analyzeImageFile, 
  analyzeImageData,
  uploadImage,
  getServerInfo,
  healthCheck,
  processAndStoreImage,
  analyzeImageBatch
} from '../dist/api-client.js';

async function runDirectHTTPExamples() {
  console.log('🚀 Direct HTTP Examples for Supabase MCP Server\n');
  
  try {
    // Initialize the API client from environment variables
    console.log('1️⃣ Initializing API client...');
    initializeAPIFromEnv();
    console.log('   ✅ API client initialized from environment variables\n');
    
    // Health check
    console.log('2️⃣ Health check...');
    const health = await healthCheck();
    console.log(`   ${health.healthy ? '✅ Server is healthy' : '❌ Server unhealthy: ' + health.error}\n`);
    
    if (!health.healthy) {
      console.log('❌ Server is not responding. Make sure:');
      console.log('   1. Supabase Edge Function is deployed');
      console.log('   2. SUPABASE_URL and SUPABASE_ANON_KEY are set');
      console.log('   3. Function name is correct (orbit-mcp-server)');
      return;
    }
    
    // Get server information
    console.log('3️⃣ Getting server information...');
    const serverInfo = await getServerInfo();
    console.log('   📊 Server Info:');
    console.log(`      Tools: ${serverInfo.tools.join(', ')}`);
    console.log(`      Version: ${serverInfo.server_info.version}`);
    console.log(`      Environment: ${serverInfo.server_info.environment}`);
    console.log(`      Endpoint: ${serverInfo.endpoint}\n`);
    
    // Example 1: Analyze image from base64 data
    console.log('4️⃣ Example 1: Analyze image from base64 data...');
    const testImagePath = '/path/to/your/test-image.png';
    
    try {
      await fs.access(testImagePath);
      console.log(`   📷 Using test image: ${testImagePath}`);
      
      // Read and convert to base64
      const imageBuffer = await fs.readFile(testImagePath);
      const base64Data = imageBuffer.toString('base64');
      console.log(`   📊 Image size: ${imageBuffer.length} bytes`);
      
      // Analyze the image
      const analysis = await analyzeImageData(base64Data, 'product');
      console.log('   ✅ Analysis completed:');
      console.log(`      Type: ${analysis.analysis_type}`);
      console.log(`      Confidence: ${analysis.confidence}`);
      console.log(`      Processing time: ${analysis.processing_time_ms}ms`);
      console.log(`      Security scan passed: ${analysis.security_scan.file_validated}\n`);
      
    } catch (error) {
      console.log(`   ⚠️ Test image not found, skipping: ${error.message}\n`);
    }
    
    // Example 2: Upload and analyze in one call
    console.log('5️⃣ Example 2: Upload and analyze in one operation...');
    try {
      await fs.access(testImagePath);
      
      const result = await processAndStoreImage(
        testImagePath,
        'test-bucket',
        'analyzed/test-image.png',
        'product',
        { source: 'direct-http-example', timestamp: new Date().toISOString() }
      );
      
      if (result.success) {
        console.log('   ✅ Upload and analysis completed:');
        console.log(`      Upload URL: ${result.upload_url}`);
        console.log(`      Analysis type: ${result.processing_info.analysis_type}`);
        console.log(`      Storage path: ${result.processing_info.storage_path}\n`);
      } else {
        console.log(`   ❌ Upload/analysis failed: ${result.error}\n`);
      }
      
    } catch (error) {
      console.log(`   ⚠️ Upload example skipped: ${error.message}\n`);
    }
    
    // Example 3: Batch processing
    console.log('6️⃣ Example 3: Batch analyze multiple images...');
    const batchImages = [
      { name: 'test-1', path: '/path/to/your/test-image-1.png', analysisType: 'product' },
      { name: 'test-2', path: '/path/to/your/test-image-2.png', analysisType: 'product' }
    ];
    
    try {
      const batchResults = await analyzeImageBatch(batchImages);
      console.log('   📊 Batch results:');
      
      for (const result of batchResults) {
        if (result.success) {
          console.log(`      ✅ ${result.name}: ${result.result.analysis_type} (${result.result.confidence} confidence)`);
        } else {
          console.log(`      ❌ ${result.name}: ${result.error}`);
        }
      }
      console.log('');
      
    } catch (error) {
      console.log(`   ⚠️ Batch processing skipped: ${error.message}\n`);
    }
    
    console.log('🎉 Direct HTTP Examples Completed!\n');
    console.log('📋 What you can do with the HTTP client:');
    console.log('   ✅ Analyze images directly via HTTP');
    console.log('   ✅ Upload images to Supabase Storage');
    console.log('   ✅ Batch process multiple images');
    console.log('   ✅ Get server analytics and status');
    console.log('   ✅ Use from web applications, scripts, or any HTTP client');
    
  } catch (error) {
    console.error('❌ Error running examples:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set');
    console.log('   2. Verify the Edge Function is deployed: supabase functions deploy orbit-mcp-server');
    console.log('   3. Check that GEMINI_API_KEY is set in Supabase secrets');
    console.log('   4. Ensure the function name matches (default: orbit-mcp-server)');
  }
}

// Example of raw HTTP calls (without using the client library)
async function rawHTTPExample() {
  console.log('\n🔧 Raw HTTP Example (without client library):');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !anonKey) {
    console.log('   ⚠️ Environment variables not set, skipping raw HTTP example');
    return;
  }
  
  try {
    // Raw HTTP request to list tools
    const response = await fetch(`${supabaseUrl}/functions/v1/orbit-mcp-server`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('   ✅ Raw HTTP request successful:');
      console.log(`      Available tools: ${result.result.tools.map(t => t.name).join(', ')}`);
    } else {
      console.log(`   ❌ Raw HTTP request failed: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Raw HTTP error: ${error.message}`);
  }
}

// Run the examples
runDirectHTTPExamples()
  .then(() => rawHTTPExample())
  .catch(console.error);