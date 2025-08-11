// URL fetching utility with comprehensive security validations
// for ORBIT Gemini Image Analysis MCP

import { SECURITY_CONFIG } from '../modules/security.js';
import { detectMimeType } from './mime-detection.js';
import { getErrorMessage } from './error-handling.js';

export interface UrlFetchOptions {
  timeout?: number;
  maxRedirects?: number;
  userAgent?: string;
  allowedDomains?: string[];
  blockedDomains?: string[];
}

export interface UrlFetchResult {
  data: Buffer;
  mimeType: string;
  url: string;
  size: number;
  statusCode: number;
}

// Default security configuration for URL fetching
const DEFAULT_URL_CONFIG = {
  TIMEOUT: 10000, // 10 seconds
  MAX_REDIRECTS: 3,
  USER_AGENT: 'ORBIT-Gemini-MCP/2.0',
  ALLOWED_PROTOCOLS: ['https:', 'http:'],
  BLOCKED_DOMAINS: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'metadata.google.internal',
    '169.254.169.254' // AWS metadata service
  ],
  BLOCKED_PORTS: [22, 23, 25, 53, 80, 135, 139, 445, 993, 995, 1433, 1521, 3306, 3389, 5432, 5984, 6379, 8080, 9200, 27017]
};

/**
 * Validates URL security before fetching
 */
export function validateUrl(url: string, options: UrlFetchOptions = {}): { valid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);
    
    // Check protocol
    if (!DEFAULT_URL_CONFIG.ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
      return { valid: false, error: `Protocol '${parsedUrl.protocol}' not allowed` };
    }
    
    // Check for blocked domains
    const hostname = parsedUrl.hostname.toLowerCase();
    const blockedDomains = [...DEFAULT_URL_CONFIG.BLOCKED_DOMAINS, ...(options.blockedDomains || [])];
    
    if (blockedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) {
      return { valid: false, error: `Domain '${hostname}' is blocked` };
    }
    
    // Check for IP addresses (basic protection against SSRF)
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(hostname)) {
      const parts = hostname.split('.').map(Number);
      // Block private IP ranges
      if (
        (parts[0] === 10) || // 10.0.0.0/8
        (parts[0] === 172 && parts[1] !== undefined && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
        (parts[0] === 192 && parts[1] !== undefined && parts[1] === 168) || // 192.168.0.0/16
        (parts[0] === 127) // 127.0.0.0/8
      ) {
        return { valid: false, error: `Private IP address '${hostname}' is blocked` };
      }
    }
    
    // Check for blocked ports
    const port = parsedUrl.port ? parseInt(parsedUrl.port) : (parsedUrl.protocol === 'https:' ? 443 : 80);
    if (DEFAULT_URL_CONFIG.BLOCKED_PORTS.includes(port)) {
      return { valid: false, error: `Port ${port} is blocked` };
    }
    
    // Check allowed domains if specified
    if (options.allowedDomains && options.allowedDomains.length > 0) {
      const isAllowed = options.allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
      if (!isAllowed) {
        return { valid: false, error: `Domain '${hostname}' is not in allowed list` };
      }
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Invalid URL: ${getErrorMessage(error)}` };
  }
}

/**
 * Fetches an image from a URL with security validations
 */
export async function fetchImageFromUrl(url: string, options: UrlFetchOptions = {}): Promise<UrlFetchResult> {
  // Validate URL first
  const validation = validateUrl(url, options);
  if (!validation.valid) {
    throw new Error(`URL validation failed: ${validation.error}`);
  }
  
  const timeout = options.timeout || DEFAULT_URL_CONFIG.TIMEOUT;
  const maxRedirects = options.maxRedirects || DEFAULT_URL_CONFIG.MAX_REDIRECTS;
  const userAgent = options.userAgent || DEFAULT_URL_CONFIG.USER_AGENT;
  
  let redirectCount = 0;
  let currentUrl = url;
  
  while (redirectCount <= maxRedirects) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          'Accept': 'image/jpeg, image/png, image/webp, image/gif, image/*;q=0.8',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal,
        redirect: 'manual' // Handle redirects manually for security
      });
      
      clearTimeout(timeoutId);
      
      // Handle redirects
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new Error(`Redirect response without location header`);
        }
        
        // Validate redirect URL
        const redirectUrl = new URL(location, currentUrl).toString();
        const redirectValidation = validateUrl(redirectUrl, options);
        if (!redirectValidation.valid) {
          throw new Error(`Redirect URL validation failed: ${redirectValidation.error}`);
        }
        
        currentUrl = redirectUrl;
        redirectCount++;
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      
      // Check content type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        throw new Error(`Content-Type '${contentType}' is not an image`);
      }
      
      // Check content length
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > SECURITY_CONFIG.MAX_FILE_SIZE) {
        throw new Error(`Content-Length ${contentLength} exceeds maximum file size`);
      }
      
      // Fetch the data
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Validate file size
      if (buffer.length > SECURITY_CONFIG.MAX_FILE_SIZE) {
        throw new Error(`Downloaded file size ${buffer.length} exceeds maximum allowed size`);
      }
      
      // Detect MIME type from content
      const detectedMimeType = detectMimeType('', buffer);
      if (!SECURITY_CONFIG.ALLOWED_MIME_TYPES.includes(detectedMimeType)) {
        throw new Error(`Detected MIME type '${detectedMimeType}' is not allowed`);
      }
      
      return {
        data: buffer,
        mimeType: detectedMimeType,
        url: currentUrl,
        size: buffer.length,
        statusCode: response.status
      };
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }
  
  throw new Error(`Too many redirects (${redirectCount})`);
}

/**
 * Converts fetched image data to base64 for Gemini processing
 */
export function imageBufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * Fetches image from URL and returns base64 data ready for Gemini
 */
export async function fetchImageAsBase64(url: string, options: UrlFetchOptions = {}): Promise<{ base64: string; mimeType: string; size: number }> {
  const result = await fetchImageFromUrl(url, options);
  const base64 = imageBufferToBase64(result.data);
  
  return {
    base64,
    mimeType: result.mimeType,
    size: result.size
  };
}

/**
 * Utility function to check if a string is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes URL by removing dangerous characters and normalizing
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    // Remove fragments and normalize
    parsedUrl.hash = '';
    return parsedUrl.toString();
  } catch {
    throw new Error('Invalid URL format');
  }
}