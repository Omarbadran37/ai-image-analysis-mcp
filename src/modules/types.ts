// TypeScript interfaces and types for ORBIT Gemini Image Analysis MCP

export interface SecurityConfig {
  MAX_FILE_SIZE: number;
  ALLOWED_MIME_TYPES: string[];
  MAX_PROMPT_LENGTH: number;
  RATE_LIMIT_WINDOW: number;
  MAX_REQUESTS_PER_WINDOW: number;
  ENABLE_PII_DETECTION: boolean;
  BLOCK_SUSPICIOUS_PATTERNS: boolean;
}

export interface AuditEntry {
  timestamp: number;
  toolName: string;
  success: boolean;
  error?: string;
  inputHash: string;
  userId?: string;
  ipAddress?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export interface RateLimitWindow {
  count: number;
  resetTime: number;
}

export interface PromptInjectionResult {
  detected: boolean;
  confidence: number;
  patterns: string[];
}

export interface PIIDetectionResult {
  detected: boolean;
  types: string[];
}

export interface SecurityScanResult {
  prompt_injection_detected: boolean;
  pii_detected: boolean;
  file_validated: boolean;
  url_validated?: boolean;
}

export interface IntegrityInfo {
  original_size: number;
  original_checksum: string;
  mime_type: string;
  upload_preserved?: boolean;
}

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

export interface UrlFetchResult {
  data: Buffer;
  mimeType: string;
  url: string;
  size: number;
  statusCode: number;
}

export interface UrlFetchOptions {
  timeout?: number;
  maxRedirects?: number;
  userAgent?: string;
  allowedDomains?: string[];
  blockedDomains?: string[];
}

export interface LifestyleAnalysis {
  scene_overview: {
    setting: string;
    time_of_day: string;
    season?: string;
    occasion?: string;
    primary_activity: string;
  };
  human_elements: {
    number_of_people: number;
    demographics?: string[];
    interactions: string;
    emotional_states: string[];
    clothing_style?: string;
    social_dynamics?: string;
  };
  environment: {
    location_type: string;
    architectural_elements?: string[];
    natural_elements?: string[];
    urban_context?: string;
    spatial_arrangement?: string;
  };
  key_objects: {
    food_and_beverage: string[];
    technology: string[];
    furniture: string[];
    personal_items: string[];
    defining_props: string[];
  };
  atmospheric_elements: {
    lighting_quality: string;
    color_palette: string[];
    mood: string;
    sensory_cues: string[];
  };
  narrative_analysis: {
    story_implied: string;
    lifestyle_values_represented: string[];
    cultural_significance?: string;
    socioeconomic_indicators?: string[];
    historical_context?: string;
  };
  photographic_elements: {
    composition: string;
    focal_points: string[];
    perspective: string;
    technical_qualities: string[];
  };
  marketing_potential: {
    target_demographic: string;
    aspirational_elements: string[];
    brand_alignment_opportunities: string[];
    emotional_hooks: string[];
  };
}

export interface ProductAnalysis {
  product_identification: {
    product_type: string;
    product_category: string;
    design_style: string;
  };
  physical_characteristics: {
    primary_color: string;
    material: string;
    pattern_type?: string;
    frame_design?: string;
    surface_texture?: string;
    backrest_style?: string;
    seat_profile?: string;
  };
  structural_elements: {
    frame_type: string;
    seat_support: string;
    arm_design: string;
    leg_structure: string;
  };
  design_attributes: {
    aesthetic_category: string;
    visual_weight: string;
    design_influence?: string;
    intended_setting?: string;
    design_cohesion?: string;
  };
  commercial_analysis: {
    market_positioning: string;
    target_market: string[];
    price_point_indication?: string;
    competitive_advantages?: string[];
    market_differentiation: string;
  };
  quality_assessment: {
    construction_quality: string;
    material_quality: string;
    finish_quality: string;
    durability_indicators?: string;
    craftsmanship_level?: string;
  };
}

export interface AnalysisResult {
  analysis_type: 'lifestyle' | 'product';
  confidence: number;
  metadata: LifestyleAnalysis | ProductAnalysis;
  processing_time_ms: number;
  security_scan: SecurityScanResult;
  integrity_info?: IntegrityInfo;
  request_id?: string;
  source?: 'file' | 'url' | 'base64';
  source_url?: string;
}

export interface UploadResult {
  success: boolean;
  path: string;
  public_url: string;
  upload_timestamp: string;
  file_size: number;
  mime_type?: string;
  integrity_checksum?: string;
}

export interface SecurityStatusResponse {
  security_config: SecurityConfig;
  rate_limit_status: {
    active_limits: number;
    current_window: number;
  };
  audit_log: {
    total_entries: number;
    recent_entries: Array<{
      timestamp: string;
      tool: string;
      success: boolean;
      error: string;
    }>;
  };
  server_info: {
    name: string;
    version: string;
    uptime: number;
    node_version: string;
  };
}

export type AnalysisType = 'lifestyle' | 'product';
export type AnalysisMetadata = LifestyleAnalysis | ProductAnalysis;