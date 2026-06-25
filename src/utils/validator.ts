/**
 * Validator - Input validation utilities
 */

import { z } from 'zod';

export class ValidationError extends Error {
  constructor(message: string, public errors: any[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate API key format
 */
export function isValidApiKey(key: string, provider: string): boolean {
  const patterns: Record<string, RegExp> = {
    claude: /^sk-ant-[a-zA-Z0-9-_]{95,}$/,
    openai: /^sk-[a-zA-Z0-9]{48,}$/,
    gemini: /^[a-zA-Z0-9_-]{39}$/
  };

  const pattern = patterns[provider];
  return pattern ? pattern.test(key) : key.length > 0;
}

/**
 * Validate UUID
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate file path
 */
export function isValidPath(path: string): boolean {
  // Basic path validation - no null bytes
  return !path.includes('\0') && path.length > 0 && path.length < 4096;
}

/**
 * Validate JSON string
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

/**
 * Validate message content
 */
export const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(100000),
  timestamp: z.number().optional(),
  metadata: z.record(z.any()).optional()
});

/**
 * Validate agent settings
 */
export const settingsSchema = z.object({
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(1000000).optional(),
  streamResponse: z.boolean().optional(),
  language: z.enum(['en', 'zh']).optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional()
});

/**
 * Validate tool parameters
 */
export function validateToolParams(
  params: Record<string, any>,
  schema: Record<string, any>
): void {
  const errors: string[] = [];

  for (const [key, def] of Object.entries(schema)) {
    const value = params[key];

    // Check required
    if (def.required && value === undefined) {
      errors.push(`Missing required parameter: ${key}`);
      continue;
    }

    // Check type
    if (value !== undefined) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== def.type) {
        errors.push(`Parameter '${key}' must be ${def.type}, got ${actualType}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid tool parameters', errors);
  }
}

/**
 * Validate model config
 */
export const modelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(['claude', 'openai', 'gemini', 'minimax', 'moonshot', 'glm', 'deepseek']),
  contextWindow: z.number().min(1000),
  maxOutput: z.number().min(100),
  inputPrice: z.number().min(0),
  outputPrice: z.number().min(0),
  capabilities: z.array(z.enum(['text', 'vision', 'function-calling', 'streaming', 'json-mode']))
});
