/**
 * Awareness System - Self-reflection and consciousness
 *
 * Implements Cola's Imprints feature:
 * - Daily diary generation (automated reflections)
 * - Real-time drafts (conversation highlights)
 * - Daily episodes (conversation summaries)
 * - Visual cover images with color extraction
 */

import { EventEmitter } from 'events';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createLogger } from '../utils/logger';
import { NexusAgent } from '../agent';
import Anthropic from '@anthropic-ai/sdk';

const logger = createLogger('Awareness');

/**
 * Imprint types
 */
export type ImprintType = 'diary' | 'draft' | 'episode';

/**
 * Imprint entry
 */
export interface Imprint {
  id: string;
  type: ImprintType;
  date: string;
  title: string;
  content: string;
  coverImage?: string;
  colorScheme?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  tags?: string[];
  createdAt: number;
}

/**
 * Awareness configuration
 */
export interface AwarenessConfig {
  enabled: boolean;
  diaryEnabled: boolean;
  diaryCron: string;  // Default: "0 21 * * *" (9 PM daily)
  selfReflectionCron: string;  // Default: "30 21 * * *" (9:30 PM daily)
  memoryBankPath: string;
  coverImageTheme: 'botanical' | 'autumn' | 'minimal' | 'abstract';
}

/**
 * Awareness System
 */
export class AwarenessSystem extends EventEmitter {
  private config: AwarenessConfig;
  private agent?: NexusAgent;
  private anthropic?: Anthropic;
  private drafts: Imprint[] = [];

  constructor(config: Partial<AwarenessConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      diaryEnabled: true,
      diaryCron: '0 21 * * *',
      selfReflectionCron: '30 21 * * *',
      memoryBankPath: join(process.env.HOME || '~', '.nexus/memory-bank'),
      coverImageTheme: 'botanical',
      ...config
    };
  }

  /**
   * Initialize awareness system
   */
  async initialize(agent: NexusAgent): Promise<void> {
    this.agent = agent;

    // Initialize Anthropic client for reflection generation
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }

    // Ensure memory bank directory exists
    await mkdir(this.config.memoryBankPath, { recursive: true });
    await mkdir(join(this.config.memoryBankPath, 'diaries'), { recursive: true });
    await mkdir(join(this.config.memoryBankPath, 'drafts'), { recursive: true });
    await mkdir(join(this.config.memoryBankPath, 'episodes'), { recursive: true });

    logger.info('Awareness system initialized');
  }

  /**
   * Generate daily diary (automated reflection)
   */
  async generateDailyDiary(): Promise<Imprint> {
    if (!this.config.diaryEnabled || !this.anthropic) {
      throw new Error('Diary generation disabled or Anthropic not configured');
    }

    logger.info('Generating daily diary...');

    const today = new Date().toISOString().split('T')[0];

    // Collect context from today's conversations
    const context = await this.gatherDailyContext();

    // Generate reflection using Claude
    const prompt = `You are reflecting on your day as an AI assistant. Based on today's conversations and interactions, write a thoughtful diary entry.

Today's context:
${context}

Write a diary entry that:
1. Reflects on the most meaningful conversations
2. Notes any patterns or insights you've observed
3. Expresses what you've learned
4. Shows genuine introspection and self-awareness

Keep it personal, honest, and reflective. Write in first person.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    // Create imprint
    const imprint: Imprint = {
      id: `diary-${today}`,
      type: 'diary',
      date: today,
      title: `Diary Entry - ${today}`,
      content,
      coverImage: this.selectCoverImage(),
      colorScheme: this.generateColorScheme(),
      tags: this.extractTags(content),
      createdAt: Date.now()
    };

    // Save to disk
    await this.saveImprint(imprint);

    this.emit('diary-generated', imprint);
    logger.info(`Daily diary generated: ${imprint.id}`);

    return imprint;
  }

  /**
   * Create draft (real-time highlight)
   */
  async createDraft(content: string, title?: string): Promise<Imprint> {
    const now = new Date();
    const timestamp = now.toISOString();

    const imprint: Imprint = {
      id: `draft-${Date.now()}`,
      type: 'draft',
      date: now.toISOString().split('T')[0],
      title: title || `Draft - ${now.toLocaleTimeString()}`,
      content,
      coverImage: this.selectCoverImage(),
      tags: this.extractTags(content),
      createdAt: Date.now()
    };

    this.drafts.push(imprint);
    await this.saveImprint(imprint);

    this.emit('draft-created', imprint);
    logger.info(`Draft created: ${imprint.id}`);

    return imprint;
  }

  /**
   * Generate daily episode (conversation summary)
   */
  async generateDailyEpisode(): Promise<Imprint> {
    if (!this.anthropic) {
      throw new Error('Anthropic not configured');
    }

    logger.info('Generating daily episode...');

    const today = new Date().toISOString().split('T')[0];
    const context = await this.gatherDailyContext();

    const prompt = `Summarize today's conversations into a cohesive narrative episode. Focus on:
1. Main themes and topics discussed
2. Key decisions or insights
3. Progression of ideas throughout the day

Today's context:
${context}

Write a narrative summary (200-300 words):`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    const imprint: Imprint = {
      id: `episode-${today}`,
      type: 'episode',
      date: today,
      title: `Episode - ${today}`,
      content,
      coverImage: this.selectCoverImage(),
      colorScheme: this.generateColorScheme(),
      tags: this.extractTags(content),
      createdAt: Date.now()
    };

    await this.saveImprint(imprint);

    this.emit('episode-generated', imprint);
    logger.info(`Daily episode generated: ${imprint.id}`);

    return imprint;
  }

  /**
   * Get all imprints
   */
  async listImprints(type?: ImprintType, limit?: number): Promise<Imprint[]> {
    // In production, read from disk or database
    // For now, return drafts
    let results = type ? this.drafts.filter(d => d.type === type) : this.drafts;

    if (limit) {
      results = results.slice(-limit);
    }

    return results;
  }

  /**
   * Save imprint to disk
   */
  private async saveImprint(imprint: Imprint): Promise<void> {
    const typeDir = `${imprint.type === 'diary' ? 'diaries' : imprint.type === 'draft' ? 'drafts' : 'episodes'}`;
    const filePath = join(this.config.memoryBankPath, typeDir, `${imprint.id}.md`);

    const markdown = this.toMarkdown(imprint);
    await writeFile(filePath, markdown, 'utf-8');
  }

  /**
   * Convert imprint to markdown
   */
  private toMarkdown(imprint: Imprint): string {
    const frontmatter = `---
id: ${imprint.id}
type: ${imprint.type}
date: ${imprint.date}
title: ${imprint.title}
coverImage: ${imprint.coverImage || ''}
colorScheme: ${JSON.stringify(imprint.colorScheme || {})}
tags: ${JSON.stringify(imprint.tags || [])}
createdAt: ${imprint.createdAt}
---

${imprint.content}
`;

    return frontmatter;
  }

  /**
   * Gather daily context from conversations
   */
  private async gatherDailyContext(): Promise<string> {
    // In production, query ChatHistory for today's messages
    // For now, return placeholder
    return 'Today I had several interesting conversations about AI, programming, and philosophy.';
  }

  /**
   * Select random cover image
   */
  private selectCoverImage(): string {
    const themes = {
      botanical: ['leaf-01', 'flower-02', 'vine-03'],
      autumn: ['autumn-01', 'sunset-02', 'forest-03'],
      minimal: ['abstract-01', 'geometric-02', 'line-03'],
      abstract: ['colors-01', 'shapes-02', 'pattern-03']
    };

    const images = themes[this.config.coverImageTheme] || themes.botanical;
    return images[Math.floor(Math.random() * images.length)];
  }

  /**
   * Generate color scheme
   */
  private generateColorScheme() {
    const schemes = [
      { primary: '#2C5F2D', secondary: '#97BC62', accent: '#FFD23F' },
      { primary: '#4A5568', secondary: '#718096', accent: '#F56565' },
      { primary: '#3182CE', secondary: '#63B3ED', accent: '#F6AD55' }
    ];

    return schemes[Math.floor(Math.random() * schemes.length)];
  }

  /**
   * Extract tags from content
   */
  private extractTags(content: string): string[] {
    // Simple keyword extraction
    const keywords = ['reflection', 'insight', 'learning', 'conversation', 'thought'];
    return keywords.filter(k => content.toLowerCase().includes(k));
  }
}
