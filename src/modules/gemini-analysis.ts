// Gemini AI analysis module for ORBIT Gemini Image Analysis MCP

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { promises as fs } from 'fs';
import { 
  AnalysisResult, 
  AnalysisType, 
  SecurityScanResult 
} from './types.js';
import { SECURITY_CONFIG, detectPromptInjection, detectPII, sanitizeInput } from './security.js';
import { validateImagePath, createIntegrityInfo } from './integrity.js';
import { detectMimeType } from '../utils/mime-detection.js';
import { getErrorMessage } from '../utils/error-handling.js';
import { fetchImageAsBase64, validateUrl, sanitizeUrl } from '../utils/url-fetcher.js';

// Lifestyle analysis prompt
export function getLifestyleAnalysisPrompt(): string {
  return `Analyze this lifestyle image comprehensively and return results in JSON format. Examine the visual narrative, social dynamics, environmental context, and cultural significance while identifying key elements that establish the lifestyle portrayed. Structure your analysis according to the following JSON schema:

{
  "scene_overview": {
    "setting": "",
    "time_of_day": "",
    "season": "",
    "occasion": "",
    "primary_activity": ""
  },
  "human_elements": {
    "number_of_people": 0,
    "demographics": [],
    "interactions": "",
    "emotional_states": [],
    "clothing_style": "",
    "social_dynamics": ""
  },
  "environment": {
    "location_type": "",
    "architectural_elements": [],
    "natural_elements": [],
    "urban_context": "",
    "spatial_arrangement": ""
  },
  "key_objects": {
    "food_and_beverage": [],
    "technology": [],
    "furniture": [],
    "personal_items": [],
    "defining_props": []
  },
  "atmospheric_elements": {
    "lighting_quality": "",
    "color_palette": [],
    "mood": "",
    "sensory_cues": []
  },
  "narrative_analysis": {
    "story_implied": "",
    "lifestyle_values_represented": [],
    "cultural_significance": "",
    "socioeconomic_indicators": [],
    "historical_context": ""
  },
  "photographic_elements": {
    "composition": "",
    "focal_points": [],
    "perspective": "",
    "technical_qualities": []
  },
  "marketing_potential": {
    "target_demographic": "",
    "aspirational_elements": [],
    "brand_alignment_opportunities": [],
    "emotional_hooks": []
  }
}

Provide comprehensive but concise entries for each field based solely on what's visible in the image. Where information cannot be determined, use "indeterminate" rather than making assumptions.`;
}

// Product analysis prompt
export function getProductAnalysisPrompt(): string {
  return `You are a specialized product image analyzer with expertise in design aesthetics, materials, construction methods, and commercial analysis. Analyze this product image to extract detailed metadata across multiple dimensions.

Return your analysis in the following JSON format:

{
  "product_identification": {
    "product_type": "",
    "product_category": "",
    "design_style": ""
  },
  "physical_characteristics": {
    "primary_color": "",
    "material": "",
    "pattern_type": "",
    "frame_design": "",
    "surface_texture": "",
    "backrest_style": "",
    "seat_profile": ""
  },
  "structural_elements": {
    "frame_type": "",
    "seat_support": "",
    "arm_design": "",
    "leg_structure": ""
  },
  "design_attributes": {
    "aesthetic_category": "",
    "visual_weight": "",
    "design_influence": "",
    "intended_setting": "",
    "design_cohesion": ""
  },
  "commercial_analysis": {
    "market_positioning": "",
    "target_market": [],
    "price_point_indication": "",
    "competitive_advantages": [],
    "market_differentiation": ""
  },
  "quality_assessment": {
    "construction_quality": "",
    "material_quality": "",
    "finish_quality": "",
    "durability_indicators": "",
    "craftsmanship_level": ""
  }
}

For each field, provide your assessment based on visual analysis. For any field you cannot determine with reasonable confidence, use "unknown" as the value.`;
}

// Main Gemini analysis function
export async function analyzeImageWithGemini(imagePath?: string, forceType?: AnalysisType, imageUrl?: string): Promise<AnalysisResult> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  // Validate exactly one input source
  if (!imagePath && !imageUrl) {
    throw new Error('Either imagePath or imageUrl must be provided');
  }
  
  if (imagePath && imageUrl) {
    throw new Error('Cannot provide both imagePath and imageUrl');
  }

  let imageBuffer: Buffer;
  let mimeType: string;
  let source: string;
  
  try {
    if (imagePath) {
      // File path processing
      if (!validateImagePath(imagePath)) {
        throw new Error('Invalid image path or potential security risk detected');
      }
      
      // Check file size
      const stats = await fs.stat(imagePath);
      if (stats.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
        throw new Error(`File size exceeds maximum allowed size of ${SECURITY_CONFIG.MAX_FILE_SIZE} bytes`);
      }

      // Read and encode image
      imageBuffer = await fs.readFile(imagePath);
      mimeType = detectMimeType(imagePath, imageBuffer);
      source = 'file';
    } else if (imageUrl) {
      // URL processing
      const sanitizedUrl = sanitizeUrl(imageUrl);
      const validation = validateUrl(sanitizedUrl);
      
      if (!validation.valid) {
        throw new Error(`URL validation failed: ${validation.error}`);
      }
      
      // Fetch image from URL
      const { base64, mimeType: detectedMimeType, size } = await fetchImageAsBase64(sanitizedUrl);
      
      if (size > SECURITY_CONFIG.MAX_FILE_SIZE) {
        throw new Error(`Downloaded image size ${size} exceeds maximum allowed size`);
      }
      
      imageBuffer = Buffer.from(base64, 'base64');
      mimeType = detectedMimeType;
      source = 'url';
    } else {
      throw new Error('No valid image source provided');
    }
    
    // Validate MIME type
    if (!SECURITY_CONFIG.ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1, // Lower temperature for more consistent analysis
        topK: 32,
        topP: 1,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    const base64Image = imageBuffer.toString('base64');
    
    // Determine analysis type (auto-detect)
    // let analysisType = forceType;
    // if (!analysisType) {
      // Use Gemini to classify the image as lifestyle or product
      const classificationPrompt = `Look at this image and determine if it should be analyzed as a "lifestyle" image (showing people, activities, scenes, environments) or a "product" image (showing individual items, objects, merchandise). Respond with only the word "lifestyle" or "product".`;
      
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
      
      const analysisType = classificationText.includes('lifestyle') ? 'lifestyle' : 'product';
    // }

    // Choose appropriate prompt based on type with security validation
    const rawPrompt = analysisType === 'lifestyle' 
      ? getLifestyleAnalysisPrompt()
      : getProductAnalysisPrompt();
    
    // Security check on prompt
    const injectionCheck = detectPromptInjection(rawPrompt);
    if (injectionCheck.detected) {
      throw new Error(`Prompt injection detected with confidence: ${injectionCheck.confidence}`);
    }
    
    const sanitizedPrompt = sanitizeInput(rawPrompt);

    // Generate content with image
    const geminiResult = await model.generateContent([
      sanitizedPrompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);

    const response = await geminiResult.response;
    const analysisText = response.text();
    
    // Security check on response
    const securityScan: SecurityScanResult = {
      prompt_injection_detected: false,
      pii_detected: false,
      file_validated: true
    };

    if (SECURITY_CONFIG.ENABLE_PII_DETECTION) {
      const piiCheck = detectPII(analysisText);
      if (piiCheck.detected) {
        console.warn(`PII detected in response: ${piiCheck.types.join(', ')}`);
        securityScan.pii_detected = true;
        // Log but don't block - might be false positive in image analysis
      }
    }
    
    // Parse JSON response with enhanced error handling
    let analysisJson;
    try {
      // Extract JSON from the response (remove markdown formatting if present)
      const jsonMatch = analysisText.match(/```json\n(.*?)\n```/s) || analysisText.match(/\{.*\}/s);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : analysisText;
      
      // Validate JSON structure before parsing
      if (!jsonText || jsonText.trim().length === 0) {
        throw new Error('Empty response from Gemini');
      }
      
      analysisJson = JSON.parse(jsonText);
      
      // Basic structure validation
      if (typeof analysisJson !== 'object' || analysisJson === null) {
        throw new Error('Invalid response structure from Gemini');
      }
      
    } catch (parseError) {
      throw new Error(`Failed to parse Gemini response: ${getErrorMessage(parseError)}`);
    }

    // Create integrity info
    const integrityInfo = createIntegrityInfo(imageBuffer, mimeType);

    const result: AnalysisResult = {
      analysis_type: analysisType,
      confidence: 0.9,
      metadata: analysisJson,
      processing_time_ms: Date.now(),
      security_scan: securityScan,
      integrity_info: integrityInfo,
      source: source as 'file' | 'url' | 'base64'
    };
    
    if (imageUrl) {
      result.source_url = imageUrl;
    }
    
    return result;
  } catch (error) {
    throw new Error(`Gemini analysis failed: ${getErrorMessage(error)}`);
  }
}