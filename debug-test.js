#!/usr/bin/env node

// Debug test script for ORBIT Gemini Image Analysis MCP
// This script tests the Gemini analysis functionality directly

import { analyzeImageWithGemini } from './dist/modules/gemini-analysis.js';
import { auditRequest, getAuditLog } from './dist/modules/security.js';
import { getErrorMessage } from './dist/utils/error-handling.js';
import { promises as fs } from 'fs';

async function debugGeminiAnalysis() {
  console.log('🔍 Debug Test: AI Image Analysis MCP');
  console.log('================================================\n');
  
  // Test image path
  const testImagePath = '/path/to/your/image.png';
  
  try {
    // Check if test image exists
    console.log('1️⃣ Checking test image...');
    await fs.access(testImagePath);
    const stats = await fs.stat(testImagePath);
    console.log(`   ✅ Image found: ${testImagePath}`);
    console.log(`   📊 File size: ${stats.size} bytes (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // Check environment variables
    console.log('\n2️⃣ Checking environment variables...');
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.log('   ❌ GEMINI_API_KEY not set');
      console.log('   💡 Please set GEMINI_API_KEY environment variable');
      return;
    }
    console.log(`   ✅ GEMINI_API_KEY set (length: ${geminiApiKey.length})`);
    
    // Test analysis with auto-detection
    console.log('\n3️⃣ Testing image analysis with auto-detection...');
    console.log('   🔄 Starting analysis...');
    
    const startTime = Date.now();
    const result = await analyzeImageWithGemini(testImagePath);
    const endTime = Date.now();
    
    console.log(`   ✅ Analysis completed in ${endTime - startTime}ms`);
    console.log(`   📊 Analysis type: ${result.analysis_type}`);
    console.log(`   📊 Confidence: ${result.confidence}`);
    console.log(`   📊 Source: ${result.source}`);
    console.log(`   📊 Image size: ${result.integrity_info.original_size} bytes`);
    console.log(`   📊 MIME type: ${result.integrity_info.mime_type}`);
    console.log(`   📊 Checksum: ${result.integrity_info.original_checksum.substring(0, 16)}...`);
    
    // Security scan results
    console.log('\n4️⃣ Security scan results...');
    console.log(`   🔒 File validated: ${result.security_scan.file_validated}`);
    console.log(`   🔒 Prompt injection detected: ${result.security_scan.prompt_injection_detected}`);
    console.log(`   🔒 PII detected: ${result.security_scan.pii_detected}`);
    
    // Show a sample of the analysis metadata
    console.log('\n5️⃣ Analysis metadata sample...');
    if (result.analysis_type === 'lifestyle' && result.metadata.scene_overview) {
      console.log('   📋 Scene Overview:');
      console.log(`      Setting: ${result.metadata.scene_overview.setting}`);
      console.log(`      Time of day: ${result.metadata.scene_overview.time_of_day}`);
      console.log(`      Primary activity: ${result.metadata.scene_overview.primary_activity}`);
      console.log(`      Occasion: ${result.metadata.scene_overview.occasion}`);
    } else if (result.analysis_type === 'product' && result.metadata.product_identification) {
      console.log('   📋 Product Identification:');
      console.log(`      Type: ${result.metadata.product_identification.product_type}`);
      console.log(`      Category: ${result.metadata.product_identification.product_category}`);
      console.log(`      Style: ${result.metadata.product_identification.design_style}`);
    }
    
    // Test with forced lifestyle analysis
    console.log('\n6️⃣ Testing forced lifestyle analysis...');
    console.log('   🔄 Starting forced lifestyle analysis...');
    
    const lifestyleStartTime = Date.now();
    const lifestyleResult = await analyzeImageWithGemini(testImagePath, 'lifestyle');
    const lifestyleEndTime = Date.now();
    
    console.log(`   ✅ Lifestyle analysis completed in ${lifestyleEndTime - lifestyleStartTime}ms`);
    console.log(`   📊 Analysis type: ${lifestyleResult.analysis_type}`);
    console.log(`   📊 Confidence: ${lifestyleResult.confidence}`);
    
    if (lifestyleResult.metadata.scene_overview) {
      console.log('   📋 Lifestyle Scene Overview:');
      console.log(`      Setting: ${lifestyleResult.metadata.scene_overview.setting}`);
      console.log(`      Time of day: ${lifestyleResult.metadata.scene_overview.time_of_day}`);
      console.log(`      Primary activity: ${lifestyleResult.metadata.scene_overview.primary_activity}`);
      console.log(`      Occasion: ${lifestyleResult.metadata.scene_overview.occasion}`);
    }
    
    // Show human elements if it's a lifestyle image
    if (lifestyleResult.metadata.human_elements) {
      console.log('   👥 Human Elements:');
      console.log(`      Number of people: ${lifestyleResult.metadata.human_elements.number_of_people}`);
      console.log(`      Interactions: ${lifestyleResult.metadata.human_elements.interactions}`);
      console.log(`      Social dynamics: ${lifestyleResult.metadata.human_elements.social_dynamics}`);
    }
    
    // Output audit log
    console.log('\n7️⃣ Audit log...');
    const auditLog = getAuditLog();
    console.log(`   📊 Total audit entries: ${auditLog.length}`);
    if (auditLog.length > 0) {
      const recent = auditLog.slice(-3);
      console.log('   📋 Recent entries:');
      recent.forEach((entry, index) => {
        console.log(`      ${index + 1}. ${entry.toolName}: ${entry.success ? 'SUCCESS' : 'FAILED'} at ${new Date(entry.timestamp).toLocaleTimeString()}`);
        if (entry.error) {
          console.log(`         Error: ${entry.error}`);
        }
      });
    }
    
    console.log('\n🎉 Debug test completed successfully!');
    
  } catch (error) {
    console.error(`\n❌ Error during debug test: ${getErrorMessage(error)}`);
    console.error('Stack trace:');
    console.error(error.stack);
    
    // Check audit log for failed attempts
    const auditLog = getAuditLog();
    const failedEntries = auditLog.filter(entry => !entry.success);
    if (failedEntries.length > 0) {
      console.log('\n📋 Failed audit entries:');
      failedEntries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.toolName}: ${entry.error} at ${new Date(entry.timestamp).toLocaleTimeString()}`);
      });
    }
  }
}

// Environment variable helper
function checkEnvironmentVariables() {
  console.log('\n🔧 Environment Variables Check:');
  console.log('===============================');
  
  const requiredVars = [
    'GEMINI_API_KEY',
    'SUPABASE_URL', 
    'SUPABASE_SERVICE_KEY'
  ];
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: Set (length: ${value.length})`);
    } else {
      console.log(`❌ ${varName}: Not set`);
    }
  });
}

// Run the debug test
console.log('Starting debug test...\n');
checkEnvironmentVariables();
debugGeminiAnalysis().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});