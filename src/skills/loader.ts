/**
 * Skill Loader - Load skills from filesystem
 */

import { Skill } from '../types';
import { skillRegistry } from './registry';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  main: string;
}

export class SkillLoader {
  private skillsDir: string;

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
  }

  /**
   * Load all skills from directory
   */
  async loadAll(): Promise<void> {
    try {
      const entries = await readdir(this.skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.loadSkill(entry.name);
        }
      }

      console.info(`[SkillLoader] Loaded ${skillRegistry.listAll().length} skills`);
    } catch (error) {
      console.error('[SkillLoader] Failed to load skills:', error);
    }
  }

  /**
   * Load single skill
   */
  async loadSkill(skillId: string): Promise<void> {
    try {
      const skillPath = join(this.skillsDir, skillId);
      const manifestPath = join(skillPath, 'manifest.json');

      // Read manifest
      const manifestData = await readFile(manifestPath, 'utf-8');
      const manifest: SkillManifest = JSON.parse(manifestData);

      // Load skill module
      const mainPath = join(skillPath, manifest.main);
      const skillModule = await import(mainPath);

      const skill: Skill = {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        author: manifest.author,
        tools: skillModule.tools || [],
        enabled: true
      };

      skillRegistry.register(skill);
    } catch (error) {
      console.error(`[SkillLoader] Failed to load skill '${skillId}':`, error);
    }
  }

  /**
   * Reload skill
   */
  async reloadSkill(skillId: string): Promise<void> {
    skillRegistry.unregister(skillId);
    await this.loadSkill(skillId);
  }
}
