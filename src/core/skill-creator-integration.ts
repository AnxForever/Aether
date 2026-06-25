/**
 * Skill Creator Integration
 *
 * Integrates dynamic skill creation into the agent pipeline
 */

import { createLogger } from '../utils/logger';
import { SkillCreator, SkillTemplate } from '../learning/skill-creator';
import { SkillRegistry } from '../skills/registry';
import { Skill, Tool, ToolResult } from '../types';

const logger = createLogger('SkillCreatorIntegration');

/**
 * Intent patterns for skill creation detection
 */
const INTENT_PATTERNS = [
  /我需要一个能(.+?)的工具/i,
  /我需要(.+?)工具/i,
  /能不能创建一个(.+?)的技能/i,
  /帮我做一个(.+?)的功能/i,
  /create a (?:tool|skill) (?:that|to) (.+)/i,
  /i need a (?:tool|skill) (?:that|to) (.+)/i,
  /make a (?:tool|skill) for (.+)/i
];

export interface SkillCreationContext {
  userMessage: string;
  sessionId: string;
  skillRegistry: SkillRegistry;
  skillCreator: SkillCreator;
}

export class SkillCreatorIntegration {
  private skillCreator: SkillCreator;
  private skillRegistry: SkillRegistry;

  constructor(skillCreator: SkillCreator, skillRegistry: SkillRegistry) {
    this.skillCreator = skillCreator;
    this.skillRegistry = skillRegistry;
  }

  /**
   * Detect if user wants to create a new skill
   */
  detectSkillCreationIntent(message: string): boolean {
    return INTENT_PATTERNS.some(pattern => pattern.test(message));
  }

  /**
   * Extract skill description from user message
   */
  extractSkillDescription(message: string): string | null {
    for (const pattern of INTENT_PATTERNS) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Create skill from user request
   */
  async createSkillFromRequest(description: string): Promise<{
    success: boolean;
    skillId?: string;
    error?: string;
  }> {
    try {
      logger.info('Creating skill from request', { description });

      // TODO: Use AI connector to generate intelligent skill template
      // For now, use basic template generation
      const template = await this.skillCreator.createFromRequest(description);

      // Validate template
      const validation = this.skillCreator.validateTemplate(template);
      if (!validation.valid) {
        const errorMsg = `Template validation failed: ${validation.errors.join(', ')}`;
        logger.error('Template validation failed', new Error(errorMsg));
        return {
          success: false,
          error: errorMsg
        };
      }

      // Generate skill code
      const skillDir = await this.skillCreator.generateSkill(template);

      // Register skill
      const skill = this.convertTemplateToSkill(template, skillDir);
      this.skillRegistry.register(skill);

      logger.info('Skill created and registered', { skillId: skill.id });

      return {
        success: true,
        skillId: skill.id
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Skill creation failed', error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Convert SkillTemplate to Skill for registration
   */
  private convertTemplateToSkill(template: SkillTemplate, skillDir: string): Skill {
    const tools: Tool[] = template.tools.map(toolDef => ({
      name: toolDef.name,
      description: toolDef.description,
      parameters: toolDef.parameters,
      handler: this.createToolHandler(toolDef.name, toolDef.implementation)
    }));

    return {
      id: this.sanitizeName(template.name),
      name: template.name,
      description: template.description,
      version: '1.0.0',
      author: 'Aether',
      tools,
      enabled: true
    };
  }

  /**
   * Create tool handler from implementation code
   *
   * TODO: This is a security risk - need sandboxing for dynamic code execution
   * For MVP, we create a stub handler that logs a warning
   */
  private createToolHandler(toolName: string, implementation: string): (params: Record<string, any>) => Promise<ToolResult> {
    return async (params: Record<string, any>): Promise<ToolResult> => {
      logger.warn('Dynamic tool execution not yet implemented (security)', {
        toolName,
        params
      });

      // TODO: Implement secure code execution with:
      // 1. VM sandboxing (vm2 or isolated-vm)
      // 2. Resource limits (CPU, memory, time)
      // 3. Network restrictions
      // 4. File system isolation

      return {
        success: false,
        error: 'Dynamic tool execution not yet implemented. Tool created but requires manual review and activation.'
      };
    };
  }

  /**
   * List all dynamically created skills
   */
  listDynamicSkills(): Skill[] {
    return this.skillRegistry
      .listAll()
      .filter(skill => skill.author === 'Aether');
  }

  /**
   * Get skill creation statistics
   */
  getStats() {
    const dynamicSkills = this.listDynamicSkills();
    return {
      totalDynamic: dynamicSkills.length,
      enabled: dynamicSkills.filter(s => s.enabled).length,
      disabled: dynamicSkills.filter(s => !s.enabled).length
    };
  }

  /**
   * Sanitize name for ID
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
