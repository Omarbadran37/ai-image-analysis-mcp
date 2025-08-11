#!/usr/bin/env node

// Debug script to test Gemini analysis on the specific image
import { analyzeImageWithGemini } from './dist/modules/gemini-analysis.js';

const imagePath = '/path/to/your/image.png';

console.log('Testing Gemini analysis on:', imagePath);
console.log('Expected: lifestyle image (people socializing at bar/restaurant)');
console.log('---');

async function testAnalysis() {
    try {
        console.log('Starting analysis...');
        const result = await analyzeImageWithGemini(imagePath);
        
        console.log('Analysis Type:', result.analysis_type);
        console.log('Confidence:', result.confidence);
        console.log('Source:', result.source);
        console.log('Processing Time:', result.processing_time_ms, 'ms');
        
        if (result.analysis_type === 'lifestyle') {
            console.log('✅ Correctly identified as lifestyle image');
        } else {
            console.log('❌ Incorrectly identified as product image');
        }
        
        console.log('\nSecurity Scan:');
        console.log('- Prompt injection detected:', result.security_scan.prompt_injection_detected);
        console.log('- PII detected:', result.security_scan.pii_detected);
        console.log('- File validated:', result.security_scan.file_validated);
        
        console.log('\nSample of analysis metadata:');
        if (result.analysis_type === 'lifestyle' && result.metadata.scene_overview) {
            console.log('Scene Overview:');
            console.log('- Setting:', result.metadata.scene_overview.setting);
            console.log('- Primary Activity:', result.metadata.scene_overview.primary_activity);
            console.log('- Occasion:', result.metadata.scene_overview.occasion);
        }
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testAnalysis();