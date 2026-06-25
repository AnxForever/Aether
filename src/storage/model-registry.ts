/**
 * Model Registry
 *
 * Dynamic model configuration and pricing management.
 * Compatible with Cola's models.json format.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { ModelConfig, AIProvider, ModelCapability } from '../types';

export interface ModelRegistryData {
  version: string;
  lastUpdated: number;
  models: ModelConfig[];
}

export class ModelRegistry {
  private models: Map<string, ModelConfig> = new Map();
  private filePath: string;
  private version: string = '1.0.0';

  constructor(filePath: string) {
    this.filePath = filePath;
    this.loadModels();
  }

  // ============================================================================
  // Model Loading & Saving
  // ============================================================================

  private loadModels(): void {
    if (!existsSync(this.filePath)) {
      this.initializeDefaultModels();
      this.saveModels();
      return;
    }

    const content = readFileSync(this.filePath, 'utf8');
    const data: ModelRegistryData = JSON.parse(content);

    this.version = data.version;
    this.models.clear();

    for (const model of data.models) {
      this.models.set(model.id, model);
    }
  }

  private saveModels(): void {
    const data: ModelRegistryData = {
      version: this.version,
      lastUpdated: Date.now(),
      models: Array.from(this.models.values()),
    };

    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  private initializeDefaultModels(): void {
    const defaultModels: ModelConfig[] = [
      // Claude Models
      {
        id: 'claude-3-7-sonnet-20250219',
        name: 'Claude 3.7 Sonnet',
        provider: 'claude',
        contextWindow: 200000,
        maxOutput: 16384,
        inputPrice: 3.0,
        outputPrice: 15.0,
        capabilities: ['text', 'vision', 'function-calling', 'streaming', 'json-mode'],
      },
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        provider: 'claude',
        contextWindow: 200000,
        maxOutput: 16384,
        inputPrice: 15.0,
        outputPrice: 75.0,
        capabilities: ['text', 'vision', 'function-calling', 'streaming', 'json-mode'],
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'claude',
        contextWindow: 200000,
        maxOutput: 8192,
        inputPrice: 0.8,
        outputPrice: 4.0,
        capabilities: ['text', 'vision', 'function-calling', 'streaming', 'json-mode'],
      },

      // OpenAI Models
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        contextWindow: 128000,
        maxOutput: 16384,
        inputPrice: 2.5,
        outputPrice: 10.0,
        capabilities: ['text', 'vision', 'function-calling', 'streaming', 'json-mode'],
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        contextWindow: 128000,
        maxOutput: 16384,
        inputPrice: 0.15,
        outputPrice: 0.6,
        capabilities: ['text', 'vision', 'function-calling', 'streaming', 'json-mode'],
      },
      {
        id: 'o1',
        name: 'OpenAI o1',
        provider: 'openai',
        contextWindow: 200000,
        maxOutput: 100000,
        inputPrice: 15.0,
        outputPrice: 60.0,
        capabilities: ['text', 'function-calling', 'json-mode'],
      },

      // Google Gemini Models
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        provider: 'gemini',
        contextWindow: 1000000,
        maxOutput: 8192,
        inputPrice: 0.0,
        outputPrice: 0.0,
        capabilities: ['text', 'vision', 'function-calling', 'streaming'],
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'gemini',
        contextWindow: 2000000,
        maxOutput: 8192,
        inputPrice: 1.25,
        outputPrice: 5.0,
        capabilities: ['text', 'vision', 'function-calling', 'streaming'],
      },

      // DeepSeek Models
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        contextWindow: 64000,
        maxOutput: 8192,
        inputPrice: 0.14,
        outputPrice: 0.28,
        capabilities: ['text', 'function-calling', 'streaming', 'json-mode'],
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        provider: 'deepseek',
        contextWindow: 64000,
        maxOutput: 8192,
        inputPrice: 0.55,
        outputPrice: 2.19,
        capabilities: ['text', 'function-calling', 'json-mode'],
      },
    ];

    for (const model of defaultModels) {
      this.models.set(model.id, model);
    }
  }

  // ============================================================================
  // Model Query
  // ============================================================================

  listModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  getModel(modelId: string): ModelConfig | undefined {
    return this.models.get(modelId);
  }

  getAllModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  getModelsByProvider(provider: AIProvider): ModelConfig[] {
    return Array.from(this.models.values()).filter((model) => model.provider === provider);
  }

  getModelsByCapability(capability: ModelCapability): ModelConfig[] {
    return Array.from(this.models.values()).filter((model) =>
      model.capabilities.includes(capability)
    );
  }

  hasModel(modelId: string): boolean {
    return this.models.has(modelId);
  }

  // ============================================================================
  // Model Management
  // ============================================================================

  addModel(model: ModelConfig): void {
    this.models.set(model.id, model);
    this.saveModels();
  }

  updateModel(modelId: string, updates: Partial<ModelConfig>): void {
    const existing = this.models.get(modelId);
    if (!existing) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const updated = { ...existing, ...updates };
    this.models.set(modelId, updated);
    this.saveModels();
  }

  removeModel(modelId: string): void {
    this.models.delete(modelId);
    this.saveModels();
  }

  // ============================================================================
  // Pricing Utilities
  // ============================================================================

  calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const inputCost = (inputTokens / 1_000_000) * model.inputPrice;
    const outputCost = (outputTokens / 1_000_000) * model.outputPrice;

    return inputCost + outputCost;
  }

  getCheapestModel(provider?: AIProvider, capability?: ModelCapability): ModelConfig | null {
    let candidates = Array.from(this.models.values());

    if (provider) {
      candidates = candidates.filter((m) => m.provider === provider);
    }

    if (capability) {
      candidates = candidates.filter((m) => m.capabilities.includes(capability));
    }

    if (candidates.length === 0) return null;

    return candidates.reduce((cheapest, current) => {
      const cheapestAvgPrice = (cheapest.inputPrice + cheapest.outputPrice) / 2;
      const currentAvgPrice = (current.inputPrice + current.outputPrice) / 2;
      return currentAvgPrice < cheapestAvgPrice ? current : cheapest;
    });
  }

  getMostCapableModel(provider?: AIProvider): ModelConfig | null {
    let candidates = Array.from(this.models.values());

    if (provider) {
      candidates = candidates.filter((m) => m.provider === provider);
    }

    if (candidates.length === 0) return null;

    return candidates.reduce((best, current) => {
      if (current.capabilities.length > best.capabilities.length) {
        return current;
      }
      if (current.capabilities.length === best.capabilities.length) {
        return current.contextWindow > best.contextWindow ? current : best;
      }
      return best;
    });
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  bulkAddModels(models: ModelConfig[]): void {
    for (const model of models) {
      this.models.set(model.id, model);
    }
    this.saveModels();
  }

  bulkUpdatePricing(updates: Array<{ modelId: string; inputPrice?: number; outputPrice?: number }>): void {
    for (const update of updates) {
      const model = this.models.get(update.modelId);
      if (!model) continue;

      if (update.inputPrice !== undefined) {
        model.inputPrice = update.inputPrice;
      }
      if (update.outputPrice !== undefined) {
        model.outputPrice = update.outputPrice;
      }

      this.models.set(update.modelId, model);
    }
    this.saveModels();
  }

  // ============================================================================
  // Reload & Reset
  // ============================================================================

  reload(): void {
    this.loadModels();
  }

  reset(): void {
    this.models.clear();
    this.initializeDefaultModels();
    this.saveModels();
  }
}
