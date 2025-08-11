// Security utilities for ORBIT Gemini Image Analysis MCP

import crypto from 'crypto';
import {
  SecurityConfig,
  AuditEntry,
  RateLimitResult,
  RateLimitWindow,
  PromptInjectionResult,
  PIIDetectionResult
} from './types.js';

// Security Configuration
export const SECURITY_CONFIG: SecurityConfig = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  MAX_PROMPT_LENGTH: 10000,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 30,
  ENABLE_PII_DETECTION: true,
  BLOCK_SUSPICIOUS_PATTERNS: true
};

// Rate limiting store
const rateLimitStore = new Map<string, RateLimitWindow>();

// Request audit log
const auditLog: AuditEntry[] = [];

// Security utility functions
export function generateSecureHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function sanitizeInput(input: string): string {
  // Remove potential HTML/script tags
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .substring(0, SECURITY_CONFIG.MAX_PROMPT_LENGTH);
}

export function detectPromptInjection(input: string): PromptInjectionResult {
  const injectionPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /forget\s+(all\s+)?(previous\s+)?instructions/i,
    /system\s*:\s*you\s+are\s+now/i,
    /\[system\]/i,
    /developer\s+mode/i,
    /jailbreak/i,
    /prompt\s+injection/i,
    /override\s+safety/i,
    /<script.*?>.*?<\/script>/i,
    /javascript\s*:/i,
    /data\s*:\s*text\/html/i
  ];

  const detectedPatterns: string[] = [];
  let score = 0;

  for (const pattern of injectionPatterns) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.toString());
      score++;
    }
  }

  // Check for base64 encoded content
  const base64Pattern = /(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)/;
  if (base64Pattern.test(input)) {
    try {
      const decoded = Buffer.from(input.match(base64Pattern)?.[0] || '', 'base64').toString();
      const recursiveCheck = detectPromptInjection(decoded);
      if (recursiveCheck.detected) {
        detectedPatterns.push('base64_encoded_injection');
        score += 2;
      }
    } catch {
      // Ignore invalid base64
    }
  }

  const confidence = Math.min(score / injectionPatterns.length, 1);
  return {
    detected: confidence > 0.3,
    confidence,
    patterns: detectedPatterns
  };
}

export function detectPII(text: string): PIIDetectionResult {
  const piiPatterns = {
    ssn: /\b\d{3}-\d{2}-\d{4}\b/,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    phone: /\b\d{3}-\d{3}-\d{4}\b/,
    creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/
  };

  const detectedTypes: string[] = [];
  
  for (const [type, pattern] of Object.entries(piiPatterns)) {
    if (pattern.test(text)) {
      detectedTypes.push(type);
    }
  }

  return {
    detected: detectedTypes.length > 0,
    types: detectedTypes
  };
}

export function checkRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const window = rateLimitStore.get(key);

  if (!window || now > window.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + SECURITY_CONFIG.RATE_LIMIT_WINDOW
    });
    return { allowed: true };
  }

  if (window.count >= SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((window.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  window.count++;
  rateLimitStore.set(key, window);
  return { allowed: true };
}

export function auditRequest(toolName: string, success: boolean, inputHash: string, error?: string) {
  const entry: AuditEntry = {
    timestamp: Date.now(),
    toolName,
    success,
    inputHash,
    ...(error && { error })
  };
  
  auditLog.push(entry);
  
  // Keep only last 1000 entries
  if (auditLog.length > 1000) {
    auditLog.shift();
  }

  // Log to console for debugging
  console.error(`[AUDIT] ${toolName}: ${success ? 'SUCCESS' : 'FAILED'} - ${inputHash}${error ? ` - ${error}` : ''}`);
}

// Get current audit log for security status
export function getAuditLog(): AuditEntry[] {
  return [...auditLog]; // Return copy to prevent external modification
}

// Get current rate limit store size
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size;
}