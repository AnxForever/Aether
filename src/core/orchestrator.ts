/**
 * Orchestrator - Main coordination engine
 *
 * Coordinates all agent components: connectors, tools, memory, etc.
 */

import { EventEmitter } from 'events';
import { Cycle, CycleStatus, UserInput, AgentContext, Message } from '../types';
import { Pipeline } from './pipeline';
import { CycleManager } from './cycle-manager';
import { connectorRegistry } from '../connectors';
import { randomUUID } from 'crypto';

export interface OrchestratorConfig {
  defaultModel: string;
  defaultProvider: string;
  maxConcurrentCycles: number;
}

export class Orchestrator extends EventEmitter {
  private pipeline: Pipeline;
  private cycleManager: CycleManager;
  private config: OrchestratorConfig;
  private activeCycles: Map<string, Cycle> = new Map();

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.pipeline = new Pipeline();
    this.cycleManager = new CycleManager();
  }

  /**
   * Process user input
   */
  async processInput(
    input: UserInput,
    context: AgentContext
  ): Promise<Message> {
    // Check concurrent cycle limit
    if (this.activeCycles.size >= this.config.maxConcurrentCycles) {
      throw new Error('Maximum concurrent cycles reached');
    }

    // Create cycle
    const cycle = this.cycleManager.createCycle(input, context);
    this.activeCycles.set(cycle.id, cycle);

    this.emit('cycle:start', cycle);

    try {
      // Run pipeline
      const result = await this.pipeline.execute({
        cycle,
        config: this.config,
        connectorRegistry
      });

      // Update cycle status
      cycle.status = 'completed';
      cycle.endTime = Date.now();

      this.emit('cycle:complete', cycle);

      return result;
    } catch (error) {
      cycle.status = 'failed';
      cycle.endTime = Date.now();

      this.emit('cycle:error', { cycle, error });

      throw error;
    } finally {
      this.activeCycles.delete(cycle.id);
    }
  }

  /**
   * Stream response
   */
  async *streamResponse(
    input: UserInput,
    context: AgentContext
  ): AsyncIterable<string> {
    const cycle = this.cycleManager.createCycle(input, context);
    this.activeCycles.set(cycle.id, cycle);

    this.emit('cycle:start', cycle);

    try {
      // Get connector
      const connector = connectorRegistry.get(this.config.defaultProvider as any);
      if (!connector) {
        throw new Error(`Connector not found: ${this.config.defaultProvider}`);
      }

      // Build messages
      const messages: Message[] = [
        {
          id: randomUUID(),
          role: 'user',
          content: input.transcript,
          timestamp: Date.now()
        }
      ];

      // Stream from connector
      for await (const chunk of connector.streamResponse({
        model: this.config.defaultModel,
        messages,
        stream: true
      })) {
        if (chunk.type === 'text') {
          yield chunk.content;
        }
      }

      cycle.status = 'completed';
      cycle.endTime = Date.now();

      this.emit('cycle:complete', cycle);
    } catch (error) {
      cycle.status = 'failed';
      cycle.endTime = Date.now();

      this.emit('cycle:error', { cycle, error });

      throw error;
    } finally {
      this.activeCycles.delete(cycle.id);
    }
  }

  /**
   * Cancel cycle
   */
  cancelCycle(cycleId: string): void {
    const cycle = this.activeCycles.get(cycleId);
    if (cycle) {
      cycle.status = 'failed';
      this.activeCycles.delete(cycleId);
      this.emit('cycle:cancelled', cycle);
    }
  }

  /**
   * Get active cycles
   */
  getActiveCycles(): Cycle[] {
    return Array.from(this.activeCycles.values());
  }

  /**
   * Check if processing
   */
  isProcessing(): boolean {
    return this.activeCycles.size > 0;
  }
}
