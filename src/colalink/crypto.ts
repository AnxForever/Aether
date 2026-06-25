/**
 * ColaLink E2EE Crypto - ECDH + AES-256-GCM end-to-end encryption
 *
 * Uses Node.js built-in crypto only (no external dependencies):
 * - ECDH (Elliptic Curve Diffie-Hellman) for key agreement
 * - HKDF for key derivation
 * - AES-256-GCM for message encryption
 */

import {
  createECDH,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
  ECDH,
} from 'crypto';

const CURVE = 'prime256v1'; // NIST P-256
const CIPHER = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits auth tag
const KEY_LENGTH = 32; // 256 bits AES key

/**
 * Encrypted message envelope
 */
export interface EncryptedPayload {
  /** Base64-encoded IV */
  iv: string;
  /** Base64-encoded auth tag */
  authTag: string;
  /** Base64-encoded ciphertext */
  ciphertext: string;
}

/**
 * E2EE Crypto - Per-instance ECDH key pair
 */
export class E2EECrypto {
  private ecdh: ECDH;
  private _publicKey: string;

  constructor() {
    this.ecdh = createECDH(CURVE);
    this._publicKey = this.ecdh.generateKeys('base64');
  }

  /**
   * Get this instance's public key (base64)
   */
  getPublicKey(): string {
    return this._publicKey;
  }

  /**
   * Compute shared secret from peer's public key
   */
  computeSharedSecret(peerPublicKey: string): Buffer {
    return this.ecdh.computeSecret(peerPublicKey, 'base64');
  }

  /**
   * Derive AES-256 key from shared secret using HKDF-like scheme
   *
   * Uses HMAC-SHA256 in a two-step extract-then-expand pattern:
   * 1. Extract: HMAC-SHA256(salt=random, ikm=sharedSecret) -> PRK
   * 2. Expand: HMAC-SHA256(PRK, info || 0x01) -> AES key
   */
  private deriveKey(sharedSecret: Buffer, salt: Buffer): Buffer {
    // Extract: PRK = HMAC-SHA256(salt, sharedSecret)
    const prk = createHmac('sha256', salt).update(sharedSecret).digest();

    // Expand: key = HMAC-SHA256(PRK, "colalink-e2ee" || 0x01)
    // Only need 32 bytes (one block), so single iteration
    const info = Buffer.from('colalink-e2ee-key', 'utf8');
    const key = createHmac('sha256', prk).update(info).digest();

    return key.subarray(0, KEY_LENGTH);
  }

  /**
   * Encrypt plaintext for a specific peer
   *
   * @param plaintext - Message text to encrypt
   * @param peerPublicKey - Recipient's ECDH public key (base64)
   * @returns Encrypted payload with iv, authTag, and ciphertext (all base64)
   */
  encrypt(plaintext: string, peerPublicKey: string): EncryptedPayload {
    const sharedSecret = this.computeSharedSecret(peerPublicKey);
    const iv = randomBytes(IV_LENGTH);
    const salt = randomBytes(16);
    const key = this.deriveKey(sharedSecret, salt);

    const cipher = createCipheriv(CIPHER, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      // Include salt so peer can derive the same key
      ciphertext: Buffer.concat([salt, encrypted]).toString('base64'),
    };
  }

  /**
   * Decrypt ciphertext from a specific peer
   *
   * @param payload - Encrypted payload (iv, authTag, ciphertext)
   * @param peerPublicKey - Sender's ECDH public key (base64)
   * @returns Decrypted plaintext string
   */
  decrypt(payload: EncryptedPayload, peerPublicKey: string): string {
    const sharedSecret = this.computeSharedSecret(peerPublicKey);
    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');

    // Extract salt (first 16 bytes) and actual ciphertext
    const raw = Buffer.from(payload.ciphertext, 'base64');
    const salt = raw.subarray(0, 16);
    const encrypted = raw.subarray(16);

    const key = this.deriveKey(sharedSecret, salt);

    const decipher = createDecipheriv(CIPHER, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Serialize encrypted payload to a single base64 string for storage
   *
   * Format: base64(iv):base64(authTag):base64(ciphertext)
   */
  static serialize(payload: EncryptedPayload): string {
    return `${payload.iv}:${payload.authTag}:${payload.ciphertext}`;
  }

  /**
   * Deserialize a serialized encrypted string back to payload
   */
  static deserialize(data: string): EncryptedPayload {
    const parts = data.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted message format');
    }
    return {
      iv: parts[0],
      authTag: parts[1],
      ciphertext: parts[2],
    };
  }
}
