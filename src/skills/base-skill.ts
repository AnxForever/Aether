/**
 * Base Skill Class
 *
 * Abstract base class for all Aether skills with i18n support
 */

import type { Skill, Tool, ToolResult } from '../types';
import type { SkillConfig, SkillContext } from './types';
import type { I18nManager } from '../i18n';

export abstract class BaseSkill {
  protected config: SkillConfig;
  protected i18n?: I18nManager;

  constructor(config: SkillConfig) {
    this.config = config;
  }

  /**
   * Set i18n manager for internationalized skill info
   */
  setI18n(i18n: I18nManager): void {
    this.i18n = i18n;
  }

  /**
   * Get skill metadata (with i18n support)
   */
  getMetadata(): SkillConfig {
    const metadata = { ...this.config };

    // Translate name and description if i18n keys are provided
    if (this.i18n) {
      if (metadata.nameKey && this.i18n.exists(metadata.nameKey)) {
        metadata.name = this.i18n.t(metadata.nameKey);
      }
      if (metadata.descriptionKey && this.i18n.exists(metadata.descriptionKey)) {
        metadata.description = this.i18n.t(metadata.descriptionKey);
      }
    }

    return metadata;
  }

  /**
   * Convert skill to Skill interface (with i18n support)
   */
  toSkill(): Skill {
    const metadata = this.getMetadata();

    return {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      version: metadata.version,
      author: metadata.author,
      tools: this.getTools(),
      enabled: metadata.enabled,
      execute: this.execute.bind(this),
    };
  }

  /**
   * Get all tools provided by this skill
   */
  abstract getTools(): any[];

  /**
   * Initialize skill (authentication, setup, etc.)
   */
  async initialize(context: SkillContext): Promise<void> {
    // Default implementation does nothing
    // Override in subclasses if needed
  }

  /**
   * Cleanup skill resources
   */
  async cleanup(): Promise<void> {
    // Default implementation does nothing
    // Override in subclasses if needed
  }

  /**
   * Check if skill is properly configured
   * Default implementation returns true
   * Override in subclasses if specific configuration checks are needed
   */
  async isConfigured(context: SkillContext): Promise<boolean> {
    return true;
  }

  /**
   * Execute skill with string args and context
   * Default implementation: stub for CLI/HTTP compatibility
   */
  async execute(args: string, context: Record<string, unknown>): Promise<ToolResult> {
    return this.createError('execute() not implemented - use getTools() instead');
  }

  /**
   * Validate parameters against schema
   */
  protected validateParams<T>(
    schema: any,
    params: unknown
  ): { success: true; data: T } | { success: false; error: string } {
    try {
      const validated = schema.parse(params);
      return { success: true, data: validated };
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: `Parameter validation failed: ${error.message}`,
        };
      }
      return {
        success: false,
        error: 'Parameter validation failed: Unknown error',
      };
    }
  }

  /**
   * Create a successful result
   */
  protected createSuccess<T>(data: T, metadata?: Record<string, any>): ToolResult {
    return {
      success: true,
      data,
      metadata,
    };
  }

  /**
   * Create an error result
   */
  protected createError(error: string, metadata?: Record<string, any>): ToolResult {
    return {
      success: false,
      error,
      metadata,
    };
  }

  /**
   * Handle errors consistently
   */
  protected handleError(error: unknown, operation: string): ToolResult {
    if (error instanceof Error) {
      return this.createError(`${operation} failed: ${error.message}`, {
        errorName: error.name,
        stack: error.stack,
      });
    }
    return this.createError(`${operation} failed: Unknown error`);
  }
}
