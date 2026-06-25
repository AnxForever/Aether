/**
 * Config Manager Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigManager, encryptString, decryptString } from '../config-manager';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import * as fs from 'fs';

describe('ConfigManager', () => {
  const testPassword = 'test-password-123!';
  let configManager: ConfigManager;

  beforeEach(() => {
    vi.clearAllMocks();
    configManager = new ConfigManager(testPassword);
  });

  describe('encryption / decryption', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'Hello, Aether!';
      const encrypted = configManager.encrypt(plaintext);

      expect(encrypted).toContain('nexus.enc.v1');
      // Format: version:iv:authTag:encrypted
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(4);

      const decrypted = configManager.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'same data';
      const encrypted1 = configManager.encrypt(plaintext);
      const encrypted2 = configManager.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt correctly
      expect(configManager.decrypt(encrypted1)).toBe(plaintext);
      expect(configManager.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should throw on invalid encrypted format', () => {
      expect(() => configManager.decrypt('invalid-format')).toThrow('Invalid encrypted data format');
    });

    it('should throw on unsupported version', () => {
      const fake = 'nexus.enc.v2:abc:def:ghi';
      expect(() => configManager.decrypt(fake)).toThrow('Unsupported encryption version');
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = configManager.encrypt('secret data');
      // Tamper with the encrypted payload part
      const parts = encrypted.split(':');
      parts[3] = parts[3].replace(/^.{4}/, 'dead');
      const tampered = parts.join(':');

      expect(() => configManager.decrypt(tampered)).toThrow();
    });
  });

  describe('API key management', () => {
    it('should return empty auth config when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = configManager.loadAuthConfig('/fake/path/auth.json');
      expect(config).toEqual({
        apiKeys: {},
        tokens: {},
      });
    });

    it('should save and load API key', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      configManager.setApiKey('/fake/path/auth.json', 'claude', 'sk-ant-api03-test');

      // Verify write was called
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(writeCall[0]).toBe('/fake/path/auth.json');
      expect(writeCall[1]).toContain('nexus.enc.v1');
    });

    it('should set and get API key round-trip', () => {
      let savedContent = '';
      vi.mocked(fs.writeFileSync).mockImplementation((_path: any, content: string) => {
        savedContent = content;
      });

      // First call (setApiKey): existsSync for loadAuthConfig
      vi.mocked(fs.existsSync).mockReturnValue(false);
      configManager.setApiKey('/fake/path/auth.json', 'openai', 'sk-test123');

      // Second call (getApiKey -> loadAuthConfig): file now exists, return saved content
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(savedContent);

      const key = configManager.getApiKey('/fake/path/auth.json', 'openai');
      expect(key).toBe('sk-test123');
    });

    it('should remove API key', () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false) // loadAuthConfig -> no file
        .mockReturnValueOnce(false); // after deletion, next load -> no file

      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      configManager.setApiKey('/fake/path/auth.json', 'gemini', 'test-key');
      configManager.removeApiKey('/fake/path/auth.json', 'gemini');

      // After removal, loadAuthConfig returns empty
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const config = configManager.loadAuthConfig('/fake/path/auth.json');
      expect(config.apiKeys['gemini']).toBeUndefined();
    });
  });

  describe('token management', () => {
    it('should set, get and remove tokens', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      configManager.setToken('/fake/path/auth.json', 'github', 'ghp_test');

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        return configManager.encrypt(JSON.stringify({
          apiKeys: {},
          tokens: { github: 'ghp_test' },
        }));
      });

      const token = configManager.getToken('/fake/path/auth.json', 'github');
      expect(token).toBe('ghp_test');

      configManager.removeToken('/fake/path/auth.json', 'github');
    });
  });

  describe('settings management', () => {
    it('should return default settings when file not found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const settings = configManager.loadSettings('/fake/path/settings.json');
      expect(settings.model).toBe('claude-3-7-sonnet-20250219');
      expect(settings.temperature).toBe(0.7);
      expect(settings.onboarding?.completed).toBe(false);
    });

    it('should load saved settings', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const testSettings = {
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 4096,
        streamResponse: false,
        language: 'en' as const,
        theme: 'dark' as const,
        onboarding: {
          completed: true,
          currentStep: 5,
          stepsCompleted: ['welcome', 'api-keys', 'model-selection'],
          skipped: false,
        },
      };
      vi.mocked(fs.readFileSync).mockReturnValue(
        configManager.encrypt(JSON.stringify(testSettings))
      );

      const settings = configManager.loadSettings('/fake/path/settings.json');
      expect(settings.model).toBe('gpt-4o');
      expect(settings.temperature).toBe(0.5);
      expect(settings.theme).toBe('dark');
    });

    it('should update settings partially', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const existingSettings = {
        model: 'claude-3',
        temperature: 0.7,
        maxTokens: 8192,
        streamResponse: true,
        language: 'en' as const,
        theme: 'auto' as const,
        onboarding: { completed: false, currentStep: 0, stepsCompleted: [] as string[], skipped: false },
      };
      vi.mocked(fs.readFileSync).mockReturnValue(
        configManager.encrypt(JSON.stringify(existingSettings))
      );
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      configManager.updateSettings('/fake/path/settings.json', {
        temperature: 0.3,
        model: 'gpt-4o',
      });

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const savedContent = writeCall[1] as string;
      const decrypted = configManager.decrypt(savedContent);
      const parsed = JSON.parse(decrypted);
      expect(parsed.model).toBe('gpt-4o');
      expect(parsed.temperature).toBe(0.3);
      expect(parsed.maxTokens).toBe(8192); // unchanged
    });
  });

  describe('utility methods', () => {
    it('should generate a salt', () => {
      const salt = ConfigManager.generateSalt();
      expect(salt).toBeTruthy();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBe(64); // 32 bytes in hex
    });

    it('should generate unique salts', () => {
      const salt1 = ConfigManager.generateSalt();
      const salt2 = ConfigManager.generateSalt();
      expect(salt1).not.toBe(salt2);
    });

    it('should derive key deterministically', () => {
      const key1 = ConfigManager.deriveKey('password', 'a'.repeat(64));
      const key2 = ConfigManager.deriveKey('password', 'a'.repeat(64));
      expect(key1.equals(key2)).toBe(true);
    });

    it('should derive different keys for different passwords', () => {
      const key1 = ConfigManager.deriveKey('password1', 'a'.repeat(64));
      const key2 = ConfigManager.deriveKey('password2', 'a'.repeat(64));
      expect(key1.equals(key2)).toBe(false);
    });

    it('should check config file existence', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      expect(configManager.configExists('/fake/path/exists.json')).toBe(true);

      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(configManager.configExists('/fake/path/nope.json')).toBe(false);
    });
  });

  describe('standalone encryption utilities', () => {
    it('should encryptString and decryptString round-trip', () => {
      const key = ConfigManager.deriveKey('test-password', 'a'.repeat(64));
      const plaintext = 'standalone test data';

      const encrypted = encryptString(plaintext, key);
      expect(encrypted).toContain('nexus.enc.v1');

      const decrypted = decryptString(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should throw on invalid format for decryptString', () => {
      const key = Buffer.alloc(32);
      expect(() => decryptString('bad', key)).toThrow('Invalid encrypted data format');
    });
  });

  describe('ConfigManager constructor', () => {
    it('should accept custom salt', () => {
      const salt = ConfigManager.generateSalt();
      const manager = new ConfigManager('password', salt);
      expect(manager).toBeInstanceOf(ConfigManager);
    });
  });
});
