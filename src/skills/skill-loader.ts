/**
 * Skill System - SKILL.md 格式技能加载与管理
 *
 * 兼容 Cola 的 SKILL.md 格式：
 * - YAML frontmatter (name, version, description, metadata)
 * - Markdown body (使用说明、示例)
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import matter from 'gray-matter';
import { createLogger } from '../utils/logger';
import type { AgentTool } from '@earendil-works/pi-agent-core';

const logger = createLogger('SkillSystem');

/**
 * 技能元数据（来自 YAML frontmatter）
 */
export interface SkillMetadata {
  name: string;
  version: string;
  description: string;
  metadata?: {
    category?: string;
    icon?: string;
    tags?: string[];
    [key: string]: any;
  };
}

/**
 * 技能定义（完整）
 */
export interface SkillDefinition extends SkillMetadata {
  /** Markdown 正文 */
  body: string;
  /** 技能目录路径 */
  path: string;
  /** 触发关键词（从 description 提取） */
  triggers: string[];
}

/**
 * 技能加载级别
 */
export type SkillLoadLevel = 'metadata' | 'body' | 'full';

/**
 * 技能加载器
 */
export class SkillLoader {
  private skills = new Map<string, SkillDefinition>();
  private handlers = new Map<string, SkillHandler>();

  constructor(private skillsDir: string) {}

  /**
   * 扫描并加载所有技能
   */
  async loadAll(level: SkillLoadLevel = 'metadata'): Promise<void> {
    logger.info(`Loading skills from: ${this.skillsDir}`);

    const entries = await readdir(this.skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = join(this.skillsDir, entry.name);
      const skillMdPath = join(skillPath, 'SKILL.md');

      try {
        const exists = await stat(skillMdPath).then(
          () => true,
          () => false
        );

        if (!exists) continue;

        const skill = await this.loadSkill(skillMdPath, level);
        this.skills.set(skill.name, skill);

        logger.debug(`Skill loaded: ${skill.name} (${level})`);
      } catch (error: any) {
        logger.error(`Failed to load skill: ${entry.name}`, error as Error);
      }
    }

    logger.info(`Loaded ${this.skills.size} skills`);
  }

  /**
   * 加载单个技能
   */
  async loadSkill(
    skillMdPath: string,
    level: SkillLoadLevel = 'metadata'
  ): Promise<SkillDefinition> {
    const content = await readFile(skillMdPath, 'utf-8');
    const parsed = matter(content);

    // 解析 frontmatter
    const metadata = parsed.data as SkillMetadata;

    if (!metadata.name || !metadata.description) {
      throw new Error(
        `Invalid SKILL.md: missing name or description in ${skillMdPath}`
      );
    }

    // 提取触发关键词
    const triggers = this.extractTriggers(metadata.description);

    const skill: SkillDefinition = {
      ...metadata,
      body: level === 'metadata' ? '' : parsed.content,
      path: dirname(skillMdPath),
      triggers,
    };

    return skill;
  }

  /**
   * 注册技能处理器
   */
  registerHandler(skillName: string, handler: SkillHandler): void {
    this.handlers.set(skillName, handler);
    logger.debug(`Handler registered: ${skillName}`);
  }

  /**
   * 获取技能
   */
  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /**
   * 获取所有技能
   */
  getAllSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * 匹配技能（根据用户输入）
   */
  matchSkills(userInput: string): SkillDefinition[] {
    const input = userInput.toLowerCase();
    const matches: Array<{ skill: SkillDefinition; score: number }> = [];

    for (const skill of this.skills.values()) {
      let score = 0;

      // 检查 name 匹配
      if (input.includes(skill.name.toLowerCase())) {
        score += 10;
      }

      // 检查 triggers 匹配
      for (const trigger of skill.triggers) {
        if (input.includes(trigger.toLowerCase())) {
          score += 5;
        }
      }

      // 检查 description 匹配
      if (skill.description.toLowerCase().includes(input)) {
        score += 3;
      }

      if (score > 0) {
        matches.push({ skill, score });
      }
    }

    // 按分数排序
    return matches
      .sort((a, b) => b.score - a.score)
      .map(m => m.skill);
  }

  /**
   * 转换为 pi-agent-core 工具
   */
  toAgentTool(skillName: string): AgentTool | undefined {
    const skill = this.skills.get(skillName);
    if (!skill) return undefined;

    const handler = this.handlers.get(skillName);
    if (!handler) {
      logger.warn(`No handler for skill: ${skillName}`);
      return undefined;
    }

    return {
      name: skill.name,
      label: skill.name,
      description: skill.description,
      parameters: handler.parameters || {
        type: 'object',
        properties: {},
      },
      execute: async (toolCallId, params, signal) => {
        try {
          const result = await handler.execute(params, signal);

          return {
            content: [
              {
                type: 'text',
                text:
                  typeof result === 'string' ? result : JSON.stringify(result, null, 2),
              },
            ],
            details: result,
          };
        } catch (error: any) {
          logger.error(`Skill execution failed: ${skillName}`, error as Error);

          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error.message}`,
              },
            ],
            details: { error: error.message },
          };
        }
      },
    };
  }

  /**
   * 提取触发关键词
   */
  private extractTriggers(description: string): string[] {
    const triggers: string[] = [];

    // 从描述中提取关键词
    const words = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);

    triggers.push(...words);

    return [...new Set(triggers)];
  }
}

/**
 * 技能处理器接口
 */
export interface SkillHandler {
  /** 参数 schema */
  parameters?: any;

  /** 执行技能 */
  execute(params: any, signal?: AbortSignal): Promise<any>;
}

/**
 * 技能注册表
 */
export class SkillRegistry {
  private loader: SkillLoader;
  private autoLoadHandlers: Map<string, () => Promise<SkillHandler>> = new Map();

  constructor(skillsDir: string) {
    this.loader = new SkillLoader(skillsDir);
  }

  /**
   * 初始化：加载所有技能元数据
   */
  async initialize(): Promise<void> {
    await this.loader.loadAll('metadata');
    logger.info('Skill registry initialized');
  }

  /**
   * 注册处理器（立即注册）
   */
  registerHandler(skillName: string, handler: SkillHandler): void {
    this.loader.registerHandler(skillName, handler);
  }

  /**
   * 注册处理器（延迟加载）
   */
  registerHandlerLazy(
    skillName: string,
    loader: () => Promise<SkillHandler>
  ): void {
    this.autoLoadHandlers.set(skillName, loader);
  }

  /**
   * 获取技能
   */
  getSkill(name: string): SkillDefinition | undefined {
    return this.loader.getSkill(name);
  }

  /**
   * 获取所有技能
   */
  getAllSkills(): SkillDefinition[] {
    return this.loader.getAllSkills();
  }

  /**
   * 匹配技能
   */
  matchSkills(userInput: string): SkillDefinition[] {
    return this.loader.matchSkills(userInput);
  }

  /**
   * 转换为 AgentTool（自动加载 handler）
   */
  async toAgentTool(skillName: string): Promise<AgentTool | undefined> {
    // 检查是否需要延迟加载
    const lazyLoader = this.autoLoadHandlers.get(skillName);
    if (lazyLoader) {
      const handler = await lazyLoader();
      this.loader.registerHandler(skillName, handler);
      this.autoLoadHandlers.delete(skillName);
    }

    return this.loader.toAgentTool(skillName);
  }

  /**
   * 转换所有匹配的技能为 AgentTool
   */
  async toAgentTools(userInput: string): Promise<AgentTool[]> {
    const matched = this.matchSkills(userInput);
    const tools: AgentTool[] = [];

    for (const skill of matched) {
      const tool = await this.toAgentTool(skill.name);
      if (tool) {
        tools.push(tool);
      }
    }

    return tools;
  }

  /**
   * 获取所有可用工具
   */
  async getAllTools(): Promise<AgentTool[]> {
    const skills = this.getAllSkills();
    const tools: AgentTool[] = [];

    for (const skill of skills) {
      const tool = await this.toAgentTool(skill.name);
      if (tool) {
        tools.push(tool);
      }
    }

    return tools;
  }
}
