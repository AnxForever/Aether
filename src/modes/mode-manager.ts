/**
 * Mode Manager - Manage agent modes with soul.md support
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { ChatMode } from './chat-mode';
import { CodingMode } from './coding-mode';
import { readFile, access } from 'fs/promises';
import { join } from 'path';

const logger = createLogger('ModeManager');

export type AgentMode = 'chat' | 'coding';

/**
 * Mode interface
 */
export interface Mode {
  name: AgentMode;
  displayName: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  temperature?: number;
  soulPath?: string;
  icon?: string;

  // Lifecycle
  onEnter?: () => Promise<void>;
  onExit?: () => Promise<void>;

  // Message processing
  processInput?: (input: string) => Promise<string>;
  processOutput?: (output: string) => Promise<string>;
}

/**
 * Mode Manager
 */
export class ModeManager extends EventEmitter {
  private currentMode: AgentMode = 'chat';
  private modes = new Map<AgentMode, Mode>();
  private modsDirectory?: string;

  constructor(modsDirectory?: string) {
    super();
    this.modsDirectory = modsDirectory;
    this.registerDefaultModes();
  }

  /**
   * Initialize mode manager and load soul.md files
   */
  async initialize(): Promise<void> {
    if (this.modsDirectory) {
      await this.loadSoulFiles();
    }
    logger.info('Mode manager initialized');
  }

  /**
   * Load soul.md files for modes
   */
  private async loadSoulFiles(): Promise<void> {
    for (const [modeName, mode] of this.modes.entries()) {
      if (mode.soulPath && this.modsDirectory) {
        await this.loadSoulForMode(modeName);
      }
    }
  }

  /**
   * Load soul.md for a specific mode
   */
  private async loadSoulForMode(modeName: AgentMode): Promise<void> {
    const mode = this.modes.get(modeName);
    if (!mode || !mode.soulPath || !this.modsDirectory) return;

    const soulPath = join(this.modsDirectory, mode.soulPath);

    try {
      await access(soulPath);
      const content = await readFile(soulPath, 'utf-8');

      // Parse and update system prompt
      const { systemPrompt } = this.parseSoulMarkdown(content);
      mode.systemPrompt = systemPrompt;
      this.modes.set(modeName, mode);

      logger.info(`Soul loaded for mode: ${modeName} (${soulPath})`);
    } catch (error) {
      logger.warn(`Soul file not found for mode ${modeName}: ${soulPath}`);
    }
  }

  /**
   * Parse soul.md markdown content
   */
  private parseSoulMarkdown(content: string): { systemPrompt: string } {
    // Remove YAML frontmatter if present
    let markdown = content;
    if (content.startsWith('---')) {
      const endIndex = content.indexOf('---', 3);
      if (endIndex !== -1) {
        markdown = content.slice(endIndex + 3).trim();
      }
    }

    return { systemPrompt: markdown };
  }

  /**
   * Register default modes
   */
  private registerDefaultModes(): void {
    this.register(new ChatMode());

    const codingMode = new CodingMode();
    (codingMode as any).soulPath = 'coding/soul.md';
    (codingMode as any).icon = '💻';
    this.register(codingMode);

    logger.info('Registered default modes: chat, coding');
  }

  /**
   * Register mode
   */
  register(mode: Mode): void {
    this.modes.set(mode.name, mode);
    logger.debug(`Registered mode: ${mode.name}`);
  }

  /**
   * Switch to mode
   */
  async switchTo(modeName: AgentMode): Promise<void> {
    if (modeName === this.currentMode) {
      logger.debug(`Already in ${modeName} mode`);
      return;
    }

    const newMode = this.modes.get(modeName);
    if (!newMode) {
      throw new Error(`Unknown mode: ${modeName}`);
    }

    logger.info(`Switching mode: ${this.currentMode} → ${modeName}`);

    // Exit current mode
    const currentMode = this.modes.get(this.currentMode);
    if (currentMode?.onExit) {
      await currentMode.onExit();
    }

    // Enter new mode
    if (newMode.onEnter) {
      await newMode.onEnter();
    }

    const previousMode = this.currentMode;
    this.currentMode = modeName;

    // Emit event
    this.emit('mode-changed', {
      from: previousMode,
      to: modeName
    });

    logger.info(`Mode switched to: ${modeName}`);
  }

  /**
   * Get current mode
   */
  getCurrentMode(): AgentMode {
    return this.currentMode;
  }

  /**
   * Get mode details
   */
  getMode(modeName: AgentMode): Mode | undefined {
    return this.modes.get(modeName);
  }

  /**
   * Get current mode details
   */
  getCurrentModeDetails(): Mode | undefined {
    return this.modes.get(this.currentMode);
  }

  /**
   * List all modes
   */
  listModes(): Mode[] {
    return Array.from(this.modes.values());
  }

  /**
   * Check if mode exists
   */
  hasMode(modeName: AgentMode): boolean {
    return this.modes.has(modeName);
  }

  /**
   * Process input with current mode
   */
  async processInput(input: string): Promise<string> {
    const mode = this.modes.get(this.currentMode);
    if (mode?.processInput) {
      return await mode.processInput(input);
    }
    return input;
  }

  /**
   * Process output with current mode
   */
  async processOutput(output: string): Promise<string> {
    const mode = this.modes.get(this.currentMode);
    if (mode?.processOutput) {
      return await mode.processOutput(output);
    }
    return output;
  }

  /**
   * Get system prompt for current mode
   */
  getSystemPrompt(): string {
    const mode = this.modes.get(this.currentMode);
    return mode?.systemPrompt || '';
  }

  /**
   * Get temperature for current mode
   */
  getTemperature(): number | undefined {
    const mode = this.modes.get(this.currentMode);
    return mode?.temperature;
  }

  /**
   * Get capabilities for current mode
   */
  getCapabilities(): string[] {
    const mode = this.modes.get(this.currentMode);
    return mode?.capabilities || [];
  }

  /**
   * Reload soul.md for current mode
   */
  async reloadSoul(): Promise<void> {
    const mode = this.modes.get(this.currentMode);
    if (mode?.soulPath) {
      await this.loadSoulForMode(this.currentMode);
      this.emit('soul-reloaded', this.currentMode);
      logger.info(`Soul reloaded for mode: ${this.currentMode}`);
    }
  }

  /**
   * Set mods directory
   */
  setModsDirectory(directory: string): void {
    this.modsDirectory = directory;
  }
}
