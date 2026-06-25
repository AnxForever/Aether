/**
 * Cycle Manager - Manages agent processing cycles
 */

import { Cycle, UserInput, AgentContext } from '../types';
import { randomUUID } from 'crypto';

export class CycleManager {
  private cycles: Map<string, Cycle> = new Map();
  private maxHistory = 1000;

  /**
   * Create a new cycle
   */
  createCycle(input: UserInput, context: AgentContext): Cycle {
    const cycle: Cycle = {
      id: randomUUID(),
      sessionId: context.sessionId,
      input,
      context,
      startTime: Date.now(),
      status: 'pending'
    };

    this.cycles.set(cycle.id, cycle);

    // Cleanup old cycles
    if (this.cycles.size > this.maxHistory) {
      const oldestId = this.cycles.keys().next().value;
      if (oldestId) {
        this.cycles.delete(oldestId);
      }
    }

    return cycle;
  }

  /**
   * Get cycle by ID
   */
  getCycle(id: string): Cycle | undefined {
    return this.cycles.get(id);
  }

  /**
   * Get cycles by session
   */
  getCyclesBySession(sessionId: string): Cycle[] {
    return Array.from(this.cycles.values())
      .filter(c => c.sessionId === sessionId)
      .sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Get all cycles
   */
  getAllCycles(): Cycle[] {
    return Array.from(this.cycles.values());
  }

  /**
   * Clear cycles
   */
  clear(): void {
    this.cycles.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    const cycles = Array.from(this.cycles.values());

    return {
      total: cycles.length,
      pending: cycles.filter(c => c.status === 'pending').length,
      processing: cycles.filter(c => c.status === 'processing').length,
      completed: cycles.filter(c => c.status === 'completed').length,
      failed: cycles.filter(c => c.status === 'failed').length,
      averageDuration: this.calculateAverageDuration(cycles)
    };
  }

  private calculateAverageDuration(cycles: Cycle[]): number {
    const completedCycles = cycles.filter(
      c => c.status === 'completed' && c.endTime
    );

    if (completedCycles.length === 0) return 0;

    const totalDuration = completedCycles.reduce(
      (sum, c) => sum + (c.endTime! - c.startTime),
      0
    );

    return totalDuration / completedCycles.length;
  }
}
