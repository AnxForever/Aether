/**
import { createLogger } from './utils/logger';
 * Skill Registry - Central skill management
 */

import { Skill, Tool } from '../types';

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  /**
   * Register a skill
   */
  register(skill: Skill): void {
    this.skills.set(skill.id, skill);
    logger.info(`[SkillRegistry] Registered: ${skill.name}`);
  }

  /**
   * Unregister a skill
   */
  unregister(skillId: string): void {
    this.skills.delete(skillId);
    logger.info(`[SkillRegistry] Unregistered: ${skillId}`);
  }

  /**
   * Get skill by ID
   */
  get(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * List all skills
   */
  listAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Alias for compatibility with CLI tools
   */
  listSkills(): Skill[] {
    return this.listAll();
  }

  /**
   * Alias for compatibility with CLI tools
   */
  getSkill(skillId: string): Skill | undefined {
    return this.get(skillId);
  }

  /**
   * List enabled skills
   */
  listEnabled(): Skill[] {
    return Array.from(this.skills.values()).filter(s => s.enabled);
  }

  /**
   * Get all tools from enabled skills
   */
  getAllTools(): Tool[] {
    const tools: Tool[] = [];

    for (const skill of this.listEnabled()) {
      tools.push(...skill.tools);
    }

    return tools;
  }

  /**
   * Find tool by name
   */
  findTool(name: string): Tool | undefined {
    for (const skill of this.listEnabled()) {
      const tool = skill.tools.find(t => t.name === name);
      if (tool) return tool;
    }
    return undefined;
  }

  /**
   * Enable skill
   */
  enable(skillId: string): void {
    const skill = this.skills.get(skillId);
    if (skill) {
      skill.enabled = true;
      logger.info(`[SkillRegistry] Enabled: ${skill.name}`);
    }
  }

  /**
   * Disable skill
   */
  disable(skillId: string): void {
    const skill = this.skills.get(skillId);
    if (skill) {
      skill.enabled = false;
      logger.info(`[SkillRegistry] Disabled: ${skill.name}`);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const skills = this.listAll();
    const enabled = this.listEnabled();

    return {
      total: skills.length,
      enabled: enabled.length,
      disabled: skills.length - enabled.length,
      totalTools: this.getAllTools().length
    };
  }
}

// Export singleton
export const skillRegistry = new SkillRegistry();
