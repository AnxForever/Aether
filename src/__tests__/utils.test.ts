/**
 * Utils Tests
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, generateToken, generateUuid } from '../utils/crypto';
import { formatBytes, formatDuration, truncate } from '../utils/formatter';
import { isValidEmail, isValidUrl, sanitizeInput } from '../utils/validator';

describe('Crypto Utils', () => {
  it('should encrypt and decrypt data', async () => {
    const plaintext = 'Hello, World!';
    const password = 'test-password';

    const encrypted = await encrypt(plaintext, password);
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toBe(plaintext);

    const decrypted = await decrypt(encrypted, password);
    expect(decrypted).toBe(plaintext);
  });

  it('should generate random tokens', () => {
    const token1 = generateToken();
    const token2 = generateToken();

    expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it('should generate UUIDs', () => {
    const uuid = generateUuid();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

describe('Formatter Utils', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(1073741824)).toBe('1.00 GB');
  });

  it('should format duration correctly', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1500)).toBe('1.50s');
    expect(formatDuration(65000)).toBe('1.08m');
  });

  it('should truncate strings', () => {
    expect(truncate('Hello, World!', 5)).toBe('He...');
    expect(truncate('Hi', 10)).toBe('Hi');
  });
});

describe('Validator Utils', () => {
  it('should validate emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('test@')).toBe(false);
  });

  it('should validate URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
    expect(isValidUrl('not-a-url')).toBe(false);
  });

  it('should sanitize input', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    expect(sanitizeInput('  Hello  ')).toBe('Hello');
  });
});
