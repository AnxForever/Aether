/**
 * Mode Switch - Automatic mode switching logic
 */

import { createLogger } from '../utils/logger';
import { ModeManager, AgentMode } from './mode-manager';

const logger = createLogger('ModeSwitch');

/**
 * Mode switch patterns
 */
const CODING_PATTERNS = [
  /write.*code/i,
  /implement/i,
  /debug/i,
  /fix.*bug/i,
  /refactor/i,
  /create.*function/i,
  /add.*feature/i,
  /modify.*code/i,
  /review.*code/i,
  /optimize/i,
  /```/,  // Code blocks
  /\bclass\b.*\{/,
  /\bfunction\b.*\(/,
  /\bconst\b.*=/,
  /\bimport\b.*from/
];

const CHAT_PATTERNS = [
  /^(hi|hello|hey)/i,
  /how are you/i,
  /tell me about/i,
  /explain/i,
  /what is/i,
  /why/i,
  /can you/i
];

/**
 * Mode Switch Analyzer
 */
export class ModeSwitchAnalyzer {
  private modeManager: ModeManager;
  private autoSwitch: boolean = true;
  private history: Array<{ input: string; mode: AgentMode }> = [];

  constructor(modeManager: ModeManager) {
    this.modeManager = modeManager;
  }

  /**
   * Enable/disable auto-switch
   */
  setAutoSwitch(enabled: boolean): void {
    this.autoSwitch = enabled;
    logger.info(`Auto-switch ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Analyze input and suggest mode
   */
  analyzeInput(input: string): AgentMode {
    // Check coding patterns
    const codingScore = this.scorePatterns(input, CODING_PATTERNS);
    const chatScore = this.scorePatterns(input, CHAT_PATTERNS);

    logger.debug(`Mode scores - Coding: ${codingScore}, Chat: ${chatScore}`);

    // Determine suggested mode
    if (codingScore > chatScore && codingScore > 0) {
      return 'coding';
    }

    // Default to chat
    return 'chat';
  }

  /**
   * Score input against patterns
   */
  private scorePatterns(input: string, patterns: RegExp[]): number {
    let score = 0;

    for (const pattern of patterns) {
      if (pattern.test(input)) {
        score++;
      }
    }

    return score;
  }

  /**
   * Process input and auto-switch if needed
   */
  async processInput(input: string): Promise<void> {
    if (!this.autoSwitch) return;

    const suggestedMode = this.analyzeInput(input);
    const currentMode = this.modeManager.getCurrentMode();

    // Add to history
    this.history.push({ input, mode: suggestedMode });
    if (this.history.length > 10) {
      this.history.shift();
    }

    // Switch if suggestion differs
    if (suggestedMode !== currentMode) {
      logger.info(`Auto-switching to ${suggestedMode} mode`);
      await this.modeManager.switchTo(suggestedMode);
    }
  }

  /**
   * Get mode distribution from history
   */
  getModeDistribution(): { chat: number; coding: number } {
    const distribution = { chat: 0, coding: 0 };

    for (const entry of this.history) {
      distribution[entry.mode]++;
    }

    return distribution;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get last N entries
   */
  getHistory(limit: number = 10): Array<{ input: string; mode: AgentMode }> {
    return this.history.slice(-limit);
  }
}
