/**
 * Crypto Utility Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  deriveKey,
  generateToken,
  generateUuid,
  hash,
  constantTimeCompare,
} from '../crypto';

describe('encrypt / decrypt', () => {
  it('should encrypt and decrypt a string correctly', async () => {
    const plaintext = 'Hello, Aether!';
    const password = 'test-password';

    const encrypted = await encrypt(plaintext, password);
    expect(encrypted).toBeTruthy();
    expect(typeof encrypted).toBe('string');

    const decrypted = await decrypt(encrypted, password);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts each time (random salt/IV)', async () => {
    const plaintext = 'same data';
    const password = 'test-pwd';

    const encrypted1 = await encrypt(plaintext, password);
    const encrypted2 = await encrypt(plaintext, password);

    expect(encrypted1).not.toBe(encrypted2);

    // Both should still decrypt correctly
    expect(await decrypt(encrypted1, password)).toBe(plaintext);
    expect(await decrypt(encrypted2, password)).toBe(plaintext);
  });

  it('should fail to decrypt with wrong password', async () => {
    const plaintext = 'secret message';
    const encrypted = await encrypt(plaintext, 'correct-password');

    await expect(decrypt(encrypted, 'wrong-password')).rejects.toThrow();
  });

  it('should handle empty string', async () => {
    const empty = '';
    const encrypted = await encrypt(empty, 'password');
    const decrypted = await decrypt(encrypted, 'password');
    expect(decrypted).toBe('');
  });

  it('should handle special characters', async () => {
    const special = 'Hello 世界! @#$%^&*()_+{}[]|\\:;"<>,.?/~`';
    const encrypted = await encrypt(special, 'p@ssw0rd!');
    const decrypted = await decrypt(encrypted, 'p@ssw0rd!');
    expect(decrypted).toBe(special);
  });
});

describe('deriveKey', () => {
  it('should derive a key from password and salt', async () => {
    const salt = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
    const key = await deriveKey('test-password', salt);
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32); // 256 bits
  });

  it('should produce deterministic keys with same inputs', async () => {
    const salt = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
    const key1 = await deriveKey('password', salt);
    const key2 = await deriveKey('password', salt);
    expect(key1.equals(key2)).toBe(true);
  });

  it('should produce different keys for different passwords', async () => {
    const salt = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
    const key1 = await deriveKey('password1', salt);
    const key2 = await deriveKey('password2', salt);
    expect(key1.equals(key2)).toBe(false);
  });
});

describe('generateToken', () => {
  it('should generate a token of specified length (in hex chars)', () => {
    const token = generateToken(16);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(32); // 16 bytes = 32 hex chars
  });

  it('should generate a token with default length', () => {
    const token = generateToken();
    expect(token.length).toBe(64); // 32 bytes = 64 hex chars
  });

  it('should generate unique tokens', () => {
    const token1 = generateToken(32);
    const token2 = generateToken(32);
    expect(token1).not.toBe(token2);
  });
});

describe('generateUuid', () => {
  it('should generate a valid UUID v4 format', () => {
    const uuid = generateUuid();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(uuid).toMatch(uuidRegex);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUuid());
    }
    expect(uuids.size).toBe(100);
  });

  it('should always have version nibble set to 4', () => {
    for (let i = 0; i < 50; i++) {
      const uuid = generateUuid();
      const parts = uuid.split('-');
      expect(parts[2][0]).toBe('4'); // version nibble
    }
  });

  it('should always have variant bits set correctly', () => {
    for (let i = 0; i < 50; i++) {
      const uuid = generateUuid();
      const parts = uuid.split('-');
      const variantNibble = parseInt(parts[3][0], 16);
      // variant must be 8, 9, a, or b (1000, 1001, 1010, 1011)
      expect(variantNibble >= 8 && variantNibble <= 11).toBe(true);
    }
  });
});

describe('hash', () => {
  it('should hash a string with SHA-256', () => {
    const result = hash('hello');
    expect(result).toBeTruthy();
    expect(result.length).toBe(64); // 256 bits = 64 hex chars
  });

  it('should produce deterministic hashes', () => {
    expect(hash('test')).toBe(hash('test'));
  });

  it('should produce different hashes for different inputs', () => {
    expect(hash('abc')).not.toBe(hash('xyz'));
  });
});

describe('constantTimeCompare', () => {
  it('should return true for equal strings', () => {
    expect(constantTimeCompare('hello', 'hello')).toBe(true);
  });

  it('should return false for different strings', () => {
    expect(constantTimeCompare('hello', 'world')).toBe(false);
  });

  it('should return false for different lengths', () => {
    expect(constantTimeCompare('abc', 'abcd')).toBe(false);
  });

  it('should handle empty strings', () => {
    expect(constantTimeCompare('', '')).toBe(true);
    expect(constantTimeCompare('', 'a')).toBe(false);
  });

  it('should handle strings with special characters', () => {
    expect(constantTimeCompare('!@#$%', '!@#$%')).toBe(true);
    expect(constantTimeCompare('!@#$%', '!@#$$')).toBe(false);
  });
});
