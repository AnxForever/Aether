/**
import { createLogger } from './utils/logger';
 * Skill Manager
 *
 * Central management for all Nexus skills
 */

import type { Skill, Tool, ToolResult } from '../types';
import type { SkillContext } from './types';
import { BaseSkill } from './base-skill';

export class SkillManager {
  private skills: Map<string, BaseSkill>;
  private context: SkillContext;

  constructor(context: SkillContext) {
    this.skills = new Map();
    this.context = context;
  }

  /**
   * Register a skill
   */
  registerSkill(skill: BaseSkill): void {
    const metadata = skill.getMetadata();

    if (this.skills.has(metadata.id)) {
      throw new Error(`Skill with id "${metadata.id}" is already registered`);
    }

    this.skills.set(metadata.id, skill);
  }

  /**
   * Unregister a skill
   */
  unregisterSkill(skillId: string): boolean {
    return this.skills.delete(skillId);
  }

  /**
   * Get a skill by ID
   */
  getSkill(skillId: string): BaseSkill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Get all registered skills
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values())
      .map(skill => skill.toSkill())
      .filter(skill => skill.enabled);
  }

  /**
   * Get all tools from all enabled skills
   */
  getAllTools(): Tool[] {
    const tools: Tool[] = [];

    for (const skill of this.skills.values()) {
      const metadata = skill.getMetadata();
      if (metadata.enabled) {
        tools.push(...skill.getTools());
      }
    }

    return tools;
  }

  /**
   * Get tools from a specific skill
   */
  getSkillTools(skillId: string): Tool[] {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill "${skillId}" not found`);
    }

    return skill.getTools();
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, params: Record<string, any>): Promise<ToolResult> {
    // Find which skill owns this tool
    for (const skill of this.skills.values()) {
      const tools = skill.getTools();
      const tool = tools.find(t => t.name === toolName);

      if (tool) {
        const metadata = skill.getMetadata();

        // Check if skill is enabled
        if (!metadata.enabled) {
          return {
            success: false,
            error: `Skill "${metadata.name}" is disabled`,
          };
        }

        // Check if skill is configured
        if (metadata.requiresAuth) {
          const isConfigured = await skill.isConfigured(this.context);
          if (!isConfigured) {
            return {
              success: false,
              error: `Skill "${metadata.name}" is not properly configured. Please check authentication.`,
            };
          }
        }

        // Execute the tool
        try {
          return await tool.handler(params);
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          };
        }
      }
    }

    return {
      success: false,
      error: `Tool "${toolName}" not found`,
    };
  }

  /**
   * Initialize all skills
   */
  async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.skills.values()).map(skill =>
      skill.initialize(this.context).catch(error => {
        const metadata = skill.getMetadata();
        logger.error(`Failed to initialize skill "${metadata.name}":`, error);
      })
    );

    await Promise.all(initPromises);
  }

  /**
   * Cleanup all skills
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.skills.values()).map(skill =>
      skill.cleanup().catch(error => {
        const metadata = skill.getMetadata();
        logger.error(`Failed to cleanup skill "${metadata.name}":`, error);
      })
    );

    await Promise.all(cleanupPromises);
  }

  /**
   * Enable a skill
   */
  enableSkill(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return false;
    }

    const metadata = skill.getMetadata();
    metadata.enabled = true;
    return true;
  }

  /**
   * Disable a skill
   */
  disableSkill(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return false;
    }

    const metadata = skill.getMetadata();
    metadata.enabled = false;
    return true;
  }

  /**
   * Check if a skill is configured
   */
  async isSkillConfigured(skillId: string): Promise<boolean> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return false;
    }

    return skill.isConfigured(this.context);
  }

  /**
   * Get skill metadata
   */
  getSkillMetadata(skillId: string) {
    const skill = this.skills.get(skillId);
    return skill?.getMetadata();
  }

  /**
   * List all skill IDs
   */
  listSkillIds(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Get skill count
   */
  getSkillCount(): number {
    return this.skills.size;
  }

  /**
   * Get enabled skill count
   */
  getEnabledSkillCount(): number {
    return Array.from(this.skills.values())
      .filter(skill => skill.getMetadata().enabled)
      .length;
  }

  /**
   * Search tools by name or description
   */
  searchTools(query: string): Tool[] {
    const lowerQuery = query.toLowerCase();
    const allTools = this.getAllTools();

    return allTools.filter(tool =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get tool by name
   */
  getTool(toolName: string): Tool | undefined {
    const allTools = this.getAllTools();
    return allTools.find(tool => tool.name === toolName);
  }

  /**
   * Check if a tool exists
   */
  hasTool(toolName: string): boolean {
    return this.getTool(toolName) !== undefined;
  }

  /**
   * Update context
   */
  updateContext(context: Partial<SkillContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Get current context
   */
  getContext(): SkillContext {
    return { ...this.context };
  }
}
