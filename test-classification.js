#!/usr/bin/env node

// Quick test script to debug image classification specifically
// This isolates the classification step to see if it's working correctly

import { GoogleGenerativeAI } from '@google/generative-ai';
import { promises as fs } from 'fs';
import { detectMimeType } from './dist/utils/mime-detection.js';

async function testImageClassification() {
  console.log('🔍 Testing Image Classification Step');
  console.log('===================================\n');
  
  const imagePath = '/path/to/your/image.png';
  
  try {
    // Check environment
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      console.log('❌ GEMINI_API_KEY not set');
      console.log('💡 Usage: GEMINI_API_KEY=your_key node test-classification.js');
      return;
    }
    
    // Read image
    console.log('📷 Reading image...');
    const imageBuffer = await fs.readFile(imagePath);
    const mimeType = detectMimeType(imagePath, imageBuffer);
    const base64Image = imageBuffer.toString('base64');
    
    console.log(`   File: ${imagePath}`);
    console.log(`   Size: ${imageBuffer.length} bytes`);
    console.log(`   MIME: ${mimeType}`);
    
    // Initialize Gemini
    console.log('\n🤖 Initializing Gemini...');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 100,
      }
    });
    
    // Test classification prompt
    console.log('\n🎯 Testing classification prompt...');
    const classificationPrompt = `Look at this image and determine if it should be analyzed as a "lifestyle" image (showing people, activities, scenes, environments) or a "product" image (showing individual items, objects, merchandise). Respond with only the word "lifestyle" or "product".`;
    
    console.log('Prompt:', classificationPrompt);
    
    const classificationResult = await model.generateContent([
      classificationPrompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);
    
    const classificationResponse = await classificationResult.response;
    const classificationText = classificationResponse.text().trim().toLowerCase();
    
    console.log(`\n📊 Classification Result: "${classificationText}"`);
    
    // Determine final classification
    const finalClassification = classificationText.includes('lifestyle') ? 'lifestyle' : 'product';
    console.log(`📊 Final Classification: "${finalClassification}"`);
    
    if (finalClassification === 'lifestyle') {
      console.log('✅ Image correctly classified as lifestyle!');
    } else {
      console.log('❌ Image incorrectly classified as product!');
      console.log('🔍 This might be the issue - the classification step is not working as expected.');
    }
    
    // Test with more detailed prompt
    console.log('\n🔍 Testing with detailed classification prompt...');
    const detailedPrompt = `Look at this image carefully. Consider these factors:
- Are there people in the image?
- Does it show a scene, environment, or activity?
- Is it showing a lifestyle, mood, or social situation?
- Or is it primarily showcasing a single product or item?

Based on the image content, classify it as either "lifestyle" or "product". 
If it shows people, activities, environments, or scenes, it's "lifestyle".
If it shows individual items, objects, or merchandise as the main focus, it's "product".

Respond with only the word "lifestyle" or "product".`;
    
    const detailedResult = await model.generateContent([
      detailedPrompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);
    
    const detailedResponse = await detailedResult.response;
    const detailedText = detailedResponse.text().trim().toLowerCase();
    
    console.log(`📊 Detailed Classification Result: "${detailedText}"`);
    
    const detailedFinal = detailedText.includes('lifestyle') ? 'lifestyle' : 'product';
    console.log(`📊 Detailed Final Classification: "${detailedFinal}"`);
    
    if (detailedFinal === 'lifestyle') {
      console.log('✅ Image correctly classified as lifestyle with detailed prompt!');
    } else {
      console.log('❌ Image still incorrectly classified as product with detailed prompt!');
    }
    
    // Test what Gemini actually sees
    console.log('\n👁️ Testing what Gemini sees in the image...');
    const descriptionPrompt = `Describe what you see in this image in detail. Focus on:
- People (how many, what they're doing)
- Setting and environment
- Activities taking place
- Objects and items present
- Overall mood and atmosphere`;
    
    const descriptionResult = await model.generateContent([
      descriptionPrompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);
    
    const descriptionResponse = await descriptionResult.response;
    const description = descriptionResponse.text();
    
    console.log('📝 Gemini\'s description of the image:');
    console.log(description);
    
    console.log('\n🎯 Analysis Complete!');
    console.log('If the classification is wrong, consider:');
    console.log('1. Updating the classification prompt in src/modules/gemini-analysis.ts');
    console.log('2. Using a different Gemini model version');
    console.log('3. Forcing the analysis type to "lifestyle" for this type of image');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testImageClassification().catch(console.error);