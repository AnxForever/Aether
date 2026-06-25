/**
 * Crypto - Cryptographic utilities
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export interface EncryptionOptions {
  algorithm?: string;
  keyLength?: number;
  ivLength?: number;
  saltLength?: number;
  scryptN?: number;
  scryptR?: number;
  scryptP?: number;
}

const DEFAULT_OPTIONS: Required<EncryptionOptions> = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 12,
  saltLength: 16,
  scryptN: 16384,
  scryptR: 8,
  scryptP: 1
};

/**
 * Derive encryption key from password
 */
export async function deriveKey(
  password: string,
  salt: Buffer,
  options: EncryptionOptions = {}
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return (await scryptAsync(password, salt, opts.keyLength)) as Buffer;
}

/**
 * Encrypt data with AES-256-GCM
 */
export async function encrypt(
  plaintext: string,
  password: string,
  options: EncryptionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Generate salt and IV
  const salt = randomBytes(opts.saltLength);
  const iv = randomBytes(opts.ivLength);

  // Derive key
  const key = await deriveKey(password, salt, opts);

  // Encrypt
  const cipher = createCipheriv(opts.algorithm, key, iv) as any;
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + encrypted
  const result = Buffer.concat([salt, iv, authTag, encrypted]);

  return result.toString('base64');
}

/**
 * Decrypt data with AES-256-GCM
 */
export async function decrypt(
  ciphertext: string,
  password: string,
  options: EncryptionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Decode base64
  const buffer = Buffer.from(ciphertext, 'base64');

  // Extract components
  const salt = buffer.subarray(0, opts.saltLength);
  const iv = buffer.subarray(opts.saltLength, opts.saltLength + opts.ivLength);
  const authTag = buffer.subarray(
    opts.saltLength + opts.ivLength,
    opts.saltLength + opts.ivLength + 16
  );
  const encrypted = buffer.subarray(opts.saltLength + opts.ivLength + 16);

  // Derive key
  const key = await deriveKey(password, salt, opts);

  // Decrypt
  const decipher = createDecipheriv(opts.algorithm, key, iv) as any;
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generate random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate UUID v4
 */
export function generateUuid(): string {
  const bytes = randomBytes(16);

  // Set version (4) and variant (RFC4122)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-');
}

/**
 * Hash string with SHA-256
 */
export function hash(data: string): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Compare hashes in constant time
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
