/**
 * ColaLink Profile - User profile management
 */

import { createLogger } from '../utils/logger';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { generateUuid } from '../utils/crypto';

const logger = createLogger('ColaLink:Profile');

/**
 * User profile
 */
export interface UserProfile {
  handle: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  deviceId: string;
  publicKey: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Profile Manager
 */
export class ProfileManager {
  private profilePath: string;
  private profile?: UserProfile;

  constructor(dataDir: string) {
    this.profilePath = join(dataDir, 'colalink-profile.json');
  }

  /**
   * Initialize profile
   */
  async initialize(): Promise<void> {
    try {
      const data = await readFile(this.profilePath, 'utf-8');
      this.profile = JSON.parse(data);
      if (this.profile) {
        logger.info(`Profile loaded: @${this.profile.handle}`);
      }
    } catch (error) {
      // Create new profile
      this.profile = {
        handle: `user_${Date.now()}`,
        displayName: 'Nexus User',
        deviceId: generateUuid(),
        publicKey: generateUuid(), // In production, generate RSA key pair
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await this.save();
      logger.info('New profile created');
    }
  }

  /**
   * Get current profile
   */
  getProfile(): UserProfile {
    if (!this.profile) {
      throw new Error('Profile not initialized');
    }
    return this.profile;
  }

  /**
   * Update profile
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    if (!this.profile) {
      throw new Error('Profile not initialized');
    }

    this.profile = {
      ...this.profile,
      ...updates,
      updatedAt: Date.now()
    };

    await this.save();
    logger.info('Profile updated');
  }

  /**
   * Lookup user by handle
   */
  async lookupHandle(handle: string): Promise<UserProfile | null> {
    // In production, query relay server
    logger.info(`Looking up handle: @${handle}`);
    return null;
  }

  /**
   * Save profile to disk
   */
  private async save(): Promise<void> {
    await writeFile(this.profilePath, JSON.stringify(this.profile, null, 2), 'utf-8');
  }
}
