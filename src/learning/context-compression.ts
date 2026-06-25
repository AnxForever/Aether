/**
 * Context Compression - Smart context window management
 */

import { createLogger } from '../utils/logger';
import { Message } from '../types';

const logger = createLogger('ContextCompression');

/**
 * Compression strategy
 */
export type CompressionStrategy = 'sliding_window' | 'importance_based' | 'summary' | 'hybrid';

/**
 * Message importance score
 */
interface MessageImportance {
  message: Message;
  score: number;
  reasons: string[];
}

/**
 * Compression result
 */
export interface CompressionResult {
  original: Message[];
  compressed: Message[];
  removedCount: number;
  compressionRatio: number;
  tokensSaved: number;
  summary?: string;
}

/**
 * Context Compression System
 */
export class ContextCompression {
  private maxTokens: number;
  private strategy: CompressionStrategy;

  constructor(maxTokens: number = 4000, strategy: CompressionStrategy = 'hybrid') {
    this.maxTokens = maxTokens;
    this.strategy = strategy;
  }

  /**
   * Compress message history
   */
  async compress(messages: Message[], targetTokens?: number): Promise<CompressionResult> {
    const target = targetTokens || this.maxTokens;

    logger.info(`Compressing ${messages.length} messages (target: ${target} tokens)`);

    let compressed: Message[];

    switch (this.strategy) {
      case 'sliding_window':
        compressed = this.slidingWindow(messages, target);
        break;

      case 'importance_based':
        compressed = await this.importanceBased(messages, target);
        break;

      case 'summary':
        compressed = await this.summarize(messages, target);
        break;

      case 'hybrid':
        compressed = await this.hybrid(messages, target);
        break;

      default:
        compressed = messages;
    }

    const originalTokens = this.estimateTokens(messages);
    const compressedTokens = this.estimateTokens(compressed);

    const result: CompressionResult = {
      original: messages,
      compressed,
      removedCount: messages.length - compressed.length,
      compressionRatio: compressedTokens / originalTokens,
      tokensSaved: originalTokens - compressedTokens
    };

    logger.info(
      `Compression complete: ${messages.length} → ${compressed.length} messages, ` +
      `${originalTokens} → ${compressedTokens} tokens (${(result.compressionRatio * 100).toFixed(1)}%)`
    );

    return result;
  }

  /**
   * Sliding window strategy
   */
  private slidingWindow(messages: Message[], targetTokens: number): Message[] {
    const systemMessages = messages.filter(m => m.role === 'system');
    let conversationMessages = messages.filter(m => m.role !== 'system');

    // Keep recent messages
    let tokens = this.estimateTokens(systemMessages);
    const kept: Message[] = [...systemMessages];

    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const msg = conversationMessages[i];
      const msgTokens = this.estimateTokens([msg]);

      if (tokens + msgTokens <= targetTokens) {
        kept.unshift(msg);
        tokens += msgTokens;
      } else {
        break;
      }
    }

    return kept;
  }

  /**
   * Importance-based strategy
   */
  private async importanceBased(messages: Message[], targetTokens: number): Promise<Message[]> {
    // Score each message
    const scored = messages.map(msg => this.scoreImportance(msg, messages));

    // Sort by importance (descending)
    scored.sort((a, b) => b.score - a.score);

    // Keep highest importance messages until token limit
    let tokens = 0;
    const kept: MessageImportance[] = [];

    for (const item of scored) {
      const msgTokens = this.estimateTokens([item.message]);

      if (tokens + msgTokens <= targetTokens) {
        kept.push(item);
        tokens += msgTokens;
      }
    }

    // Sort back to chronological order
    kept.sort((a, b) => a.message.timestamp - b.message.timestamp);

    return kept.map(item => item.message);
  }

  /**
   * Summary strategy
   */
  private async summarize(messages: Message[], targetTokens: number): Promise<Message[]> {
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    // Keep recent messages
    const recentCount = Math.min(5, conversationMessages.length);
    const recent = conversationMessages.slice(-recentCount);

    // Summarize older messages
    const older = conversationMessages.slice(0, -recentCount);

    if (older.length === 0) {
      return messages;
    }

    const summary = this.generateSummary(older);

    const summaryMessage: Message = {
      id: `summary-${Date.now()}`,
      role: 'system',
      content: `[Context Summary]: ${summary}`,
      timestamp: older[0].timestamp
    };

    return [...systemMessages, summaryMessage, ...recent];
  }

  /**
   * Hybrid strategy
   */
  private async hybrid(messages: Message[], targetTokens: number): Promise<Message[]> {
    const currentTokens = this.estimateTokens(messages);

    // If within limits, no compression needed
    if (currentTokens <= targetTokens) {
      return messages;
    }

    // If only slightly over, use sliding window
    if (currentTokens < targetTokens * 1.2) {
      return this.slidingWindow(messages, targetTokens);
    }

    // If significantly over, use summary + importance
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    // Keep recent 10 messages
    const recentCount = Math.min(10, conversationMessages.length);
    const recent = conversationMessages.slice(-recentCount);
    const older = conversationMessages.slice(0, -recentCount);

    if (older.length === 0) {
      return this.importanceBased(messages, targetTokens);
    }

    // Summarize older messages
    const summary = this.generateSummary(older);
    const summaryMessage: Message = {
      id: `summary-${Date.now()}`,
      role: 'system',
      content: `[Context Summary]: ${summary}`,
      timestamp: older[0].timestamp
    };

    // Score and filter recent messages by importance
    const scored = recent.map(msg => this.scoreImportance(msg, conversationMessages));
    scored.sort((a, b) => b.score - a.score);

    const remainingTokens = targetTokens - this.estimateTokens([...systemMessages, summaryMessage]);
    let tokens = 0;
    const kept: Message[] = [];

    for (const item of scored) {
      const msgTokens = this.estimateTokens([item.message]);
      if (tokens + msgTokens <= remainingTokens) {
        kept.push(item.message);
        tokens += msgTokens;
      }
    }

    // Sort back to chronological order
    kept.sort((a, b) => a.timestamp - b.timestamp);

    return [...systemMessages, summaryMessage, ...kept];
  }

  /**
   * Score message importance
   */
  private scoreImportance(message: Message, context: Message[]): MessageImportance {
    let score = 0;
    const reasons: string[] = [];

    // System messages are always important
    if (message.role === 'system') {
      score += 10;
      reasons.push('system_message');
    }

    // Recent messages are more important
    const age = Date.now() - message.timestamp;
    if (age < 5 * 60 * 1000) {
      score += 5;
      reasons.push('recent');
    }

    // Messages with tool calls are important
    if (message.toolCalls && message.toolCalls.length > 0) {
      score += 8;
      reasons.push('tool_usage');
    }

    // Long messages might contain important information
    if (message.content.length > 500) {
      score += 3;
      reasons.push('detailed_content');
    }

    // Messages with code blocks are important
    if (message.content.includes('```')) {
      score += 4;
      reasons.push('code_content');
    }

    // Questions are important
    if (message.content.includes('?')) {
      score += 2;
      reasons.push('question');
    }

    return { message, score, reasons };
  }

  /**
   * Generate summary of messages
   */
  private generateSummary(messages: Message[]): string {
    // Simple extractive summary
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    const summary = [
      `Previous conversation (${messages.length} messages):`,
      `User discussed: ${this.extractKeyPoints(userMessages.map(m => m.content))}`,
      `Assistant provided: ${this.extractKeyPoints(assistantMessages.map(m => m.content))}`
    ];

    return summary.join(' ');
  }

  /**
   * Extract key points from content
   */
  private extractKeyPoints(contents: string[]): string {
    // Simple keyword extraction
    const combined = contents.join(' ');
    const words = combined.split(/\s+/);

    // Take first 50 words as key points
    return words.slice(0, 50).join(' ') + (words.length > 50 ? '...' : '');
  }

  /**
   * Estimate token count
   */
  private estimateTokens(messages: Message[]): number {
    // Rough estimation: 1 token ≈ 4 characters
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Set compression strategy
   */
  setStrategy(strategy: CompressionStrategy): void {
    this.strategy = strategy;
    logger.info(`Compression strategy changed to: ${strategy}`);
  }

  /**
   * Set max tokens
   */
  setMaxTokens(maxTokens: number): void {
    this.maxTokens = maxTokens;
    logger.info(`Max tokens set to: ${maxTokens}`);
  }
}
