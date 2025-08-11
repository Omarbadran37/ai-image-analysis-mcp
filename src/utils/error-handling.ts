// Error handling utilities for ORBIT Gemini Image Analysis MCP

// Type guard for error objects
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Type guard for objects with message property
export function hasMessage(error: unknown): error is { message: string } {
  return typeof error === 'object' && error !== null && 'message' in error;
}

// Safe error message extraction
export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (hasMessage(error)) return error.message;
  return String(error);
}