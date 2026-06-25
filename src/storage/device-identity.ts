/**
 * Device Identity
 *
 * UUID generation and persistence for device identification.
 * Compatible with Cola's identity.json format.
 */

import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';

export interface DeviceIdentity {
  deviceId: string;
  createdAt: number;
  platform: string;
  version: string;
}

export class DeviceIdentityManager {
  private filePath: string;
  private identity: DeviceIdentity | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.loadIdentity();
  }

  // ============================================================================
  // Identity Loading & Saving
  // ============================================================================

  private loadIdentity(): void {
    if (!existsSync(this.filePath)) {
      this.identity = this.createNewIdentity();
      this.saveIdentity();
      return;
    }

    const content = readFileSync(this.filePath, 'utf8');
    this.identity = JSON.parse(content) as DeviceIdentity;
  }

  private saveIdentity(): void {
    if (!this.identity) {
      throw new Error('No identity to save');
    }

    writeFileSync(this.filePath, JSON.stringify(this.identity, null, 2), 'utf8');
  }

  private createNewIdentity(): DeviceIdentity {
    return {
      deviceId: randomUUID(),
      createdAt: Date.now(),
      platform: process.platform,
      version: process.version,
    };
  }

  // ============================================================================
  // Identity Access
  // ============================================================================

  getDeviceId(): string {
    if (!this.identity) {
      throw new Error('Identity not loaded');
    }
    return this.identity.deviceId;
  }

  getIdentity(): DeviceIdentity {
    if (!this.identity) {
      throw new Error('Identity not loaded');
    }
    return { ...this.identity };
  }

  // ============================================================================
  // Identity Management
  // ============================================================================

  regenerate(): string {
    this.identity = this.createNewIdentity();
    this.saveIdentity();
    return this.identity.deviceId;
  }

  updateVersion(version: string): void {
    if (!this.identity) {
      throw new Error('Identity not loaded');
    }

    this.identity.version = version;
    this.saveIdentity();
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  static generateUUID(): string {
    return randomUUID();
  }

  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
