/**
 * Config Manager
 *
 * Encrypted configuration storage compatible with Cola's format:
 * - auth.json: API keys and tokens
 * - settings.json: User preferences
 *
 * Format: nexus.enc.v1:<iv>:<authTag>:<encrypted>
 * Encryption: AES-256-GCM
 * Key Derivation: scrypt (N=16384, r=8, p=1)
 */

import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { AuthConfig, AgentSettings, AIProvider } from '../types';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCODING_VERSION = 'nexus.enc.v1';

export interface EncryptedData {
  version: string;
  iv: string;
  authTag: string;
  encrypted: string;
}

export class ConfigManager {
  private masterKey: Buffer;

  constructor(password: string, salt?: string) {
    // Derive master key from password using scrypt
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : randomBytes(32);
    this.masterKey = scryptSync(password, saltBuffer, KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
  }

  // ============================================================================
  // Encryption / Decryption
  // ============================================================================

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.masterKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: nexus.enc.v1:<iv>:<authTag>:<encrypted>
    return `${ENCODING_VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');

    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const [version, ivHex, authTagHex, encrypted] = parts;

    if (version !== ENCODING_VERSION) {
      throw new Error(`Unsupported encryption version: ${version}`);
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // ============================================================================
  // Auth Config (auth.json)
  // ============================================================================

  loadAuthConfig(filePath: string): AuthConfig {
    if (!existsSync(filePath)) {
      return {
        apiKeys: {} as Record<AIProvider, string>,
        tokens: {},
      };
    }

    const encryptedContent = readFileSync(filePath, 'utf8');
    const decrypted = this.decrypt(encryptedContent);
    return JSON.parse(decrypted) as AuthConfig;
  }

  saveAuthConfig(filePath: string, config: AuthConfig): void {
    const plaintext = JSON.stringify(config, null, 2);
    const encrypted = this.encrypt(plaintext);
    writeFileSync(filePath, encrypted, 'utf8');
  }

  setApiKey(filePath: string, provider: AIProvider, apiKey: string): void {
    const config = this.loadAuthConfig(filePath);
    config.apiKeys[provider] = apiKey;
    this.saveAuthConfig(filePath, config);
  }

  getApiKey(filePath: string, provider: AIProvider): string | undefined {
    const config = this.loadAuthConfig(filePath);
    return config.apiKeys[provider];
  }

  removeApiKey(filePath: string, provider: AIProvider): void {
    const config = this.loadAuthConfig(filePath);
    delete config.apiKeys[provider];
    this.saveAuthConfig(filePath, config);
  }

  setToken(filePath: string, key: string, token: string): void {
    const config = this.loadAuthConfig(filePath);
    config.tokens[key] = token;
    this.saveAuthConfig(filePath, config);
  }

  getToken(filePath: string, key: string): string | undefined {
    const config = this.loadAuthConfig(filePath);
    return config.tokens[key];
  }

  removeToken(filePath: string, key: string): void {
    const config = this.loadAuthConfig(filePath);
    delete config.tokens[key];
    this.saveAuthConfig(filePath, config);
  }

  // ============================================================================
  // Settings Config (settings.json)
  // ============================================================================

  loadSettings(filePath: string): AgentSettings {
    if (!existsSync(filePath)) {
      return this.getDefaultSettings();
    }

    const encryptedContent = readFileSync(filePath, 'utf8');
    const decrypted = this.decrypt(encryptedContent);
    return JSON.parse(decrypted) as AgentSettings;
  }

  saveSettings(filePath: string, settings: AgentSettings): void {
    const plaintext = JSON.stringify(settings, null, 2);
    const encrypted = this.encrypt(plaintext);
    writeFileSync(filePath, encrypted, 'utf8');
  }

  updateSettings(filePath: string, updates: Partial<AgentSettings>): void {
    const currentSettings = this.loadSettings(filePath);
    const newSettings = { ...currentSettings, ...updates };
    this.saveSettings(filePath, newSettings);
  }

  getSetting<K extends keyof AgentSettings>(
    filePath: string,
    key: K
  ): AgentSettings[K] | undefined {
    const settings = this.loadSettings(filePath);
    return settings[key];
  }

  setSetting<K extends keyof AgentSettings>(
    filePath: string,
    key: K,
    value: AgentSettings[K]
  ): void {
    const settings = this.loadSettings(filePath);
    settings[key] = value;
    this.saveSettings(filePath, settings);
  }

  private getDefaultSettings(): AgentSettings {
    return {
      model: 'claude-3-7-sonnet-20250219',
      temperature: 0.7,
      maxTokens: 8192,
      streamResponse: true,
      language: 'en',
      theme: 'auto',
      onboarding: {
        completed: false,
        currentStep: 0,
        stepsCompleted: [],
        skipped: false,
      },
    };
  }

  // ============================================================================
  // Generic Config Operations
  // ============================================================================

  loadConfig<T>(filePath: string, defaultValue?: T): T {
    if (!existsSync(filePath)) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Config file not found: ${filePath}`);
    }

    const encryptedContent = readFileSync(filePath, 'utf8');
    const decrypted = this.decrypt(encryptedContent);
    return JSON.parse(decrypted) as T;
  }

  saveConfig<T>(filePath: string, data: T): void {
    const plaintext = JSON.stringify(data, null, 2);
    const encrypted = this.encrypt(plaintext);
    writeFileSync(filePath, encrypted, 'utf8');
  }

  configExists(filePath: string): boolean {
    return existsSync(filePath);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  static generateSalt(): string {
    return randomBytes(32).toString('hex');
  }

  static deriveKey(password: string, salt: string): Buffer {
    const saltBuffer = Buffer.from(salt, 'hex');
    return scryptSync(password, saltBuffer, KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
  }

  rotateKey(newPassword: string, authPath: string, settingsPath: string): void {
    // Load existing configs
    const auth = this.loadAuthConfig(authPath);
    const settings = this.loadSettings(settingsPath);

    // Create new ConfigManager with new password
    const salt = ConfigManager.generateSalt();
    const newManager = new ConfigManager(newPassword, salt);

    // Re-encrypt and save
    newManager.saveAuthConfig(authPath, auth);
    newManager.saveSettings(settingsPath, settings);
  }
}

// ============================================================================
// Standalone Encryption Utilities
// ============================================================================

export function encryptString(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${ENCODING_VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptString(ciphertext: string, key: Buffer): string {
  const parts = ciphertext.split(':');

  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }

  const [version, ivHex, authTagHex, encrypted] = parts;

  if (version !== ENCODING_VERSION) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
