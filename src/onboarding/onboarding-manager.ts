/**
 * Onboarding Manager - Handles first-time user setup
 */

import { EventEmitter } from 'events';
import { ConfigManager } from '../storage/config-manager';
import { createLogger } from '../utils/logger';
import {
  OnboardingStep,
  OnboardingProgress,
  APIKeyValidation,
  OnboardingCompletionData,
  OnboardingStepConfig,
} from '../types/onboarding';
import { AIProvider, AgentSettings } from '../types';
import { join } from 'path';

const logger = createLogger('OnboardingManager');

/**
 * Onboarding step configurations
 */
const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: 'welcome',
    title: 'Welcome to Aether',
    description: 'Your multi-AI orchestration platform',
    canSkip: false,
    isRequired: true,
    estimatedTime: 30,
  },
  {
    id: 'api-keys',
    title: 'Configure API Keys',
    description: 'Add at least one AI provider',
    canSkip: false,
    isRequired: true,
    estimatedTime: 120,
  },
  {
    id: 'model-selection',
    title: 'Choose Default Model',
    description: 'Select your preferred AI model',
    canSkip: false,
    isRequired: true,
    estimatedTime: 30,
  },
  {
    id: 'quick-tour',
    title: 'Quick Tour',
    description: 'Learn the basics',
    canSkip: true,
    isRequired: false,
    estimatedTime: 60,
  },
  {
    id: 'complete',
    title: 'Ready to Go',
    description: 'Setup complete',
    canSkip: false,
    isRequired: true,
    estimatedTime: 10,
  },
];

/**
 * Onboarding Manager
 */
export class OnboardingManager extends EventEmitter {
  private configManager: ConfigManager;
  private dataDir: string;
  private currentStep: OnboardingStep = 'welcome';
  private completedSteps: OnboardingStep[] = [];
  private configuredProviders: AIProvider[] = [];

  constructor(dataDir: string, configManager: ConfigManager) {
    super();
    this.dataDir = dataDir;
    this.configManager = configManager;
  }

  /**
   * Check if onboarding is needed
   */
  isOnboardingNeeded(): boolean {
    try {
      const settingsPath = join(this.dataDir, 'settings.json');
      const settings = this.configManager.loadSettings(settingsPath);
      return !settings.onboarding?.completed;
    } catch (error) {
      // If settings don't exist or can't be loaded, onboarding is needed
      logger.info('Settings not found, onboarding needed');
      return true;
    }
  }

  /**
   * Get onboarding progress
   */
  getProgress(): OnboardingProgress {
    const currentIndex = ONBOARDING_STEPS.findIndex(s => s.id === this.currentStep);
    const completedCount = this.completedSteps.length;

    return {
      currentStep: this.currentStep,
      completedSteps: this.completedSteps,
      totalSteps: ONBOARDING_STEPS.length,
      percentComplete: Math.round((completedCount / ONBOARDING_STEPS.length) * 100),
    };
  }

  /**
   * Get step configuration
   */
  getStepConfig(step: OnboardingStep): OnboardingStepConfig | undefined {
    return ONBOARDING_STEPS.find(s => s.id === step);
  }

  /**
   * Get all step configurations
   */
  getAllSteps(): OnboardingStepConfig[] {
    return ONBOARDING_STEPS;
  }

  /**
   * Move to next step
   */
  nextStep(): void {
    const currentIndex = ONBOARDING_STEPS.findIndex(s => s.id === this.currentStep);

    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      this.completedSteps.push(this.currentStep);
      this.currentStep = ONBOARDING_STEPS[currentIndex + 1].id;

      this.emit('step-changed', {
        from: ONBOARDING_STEPS[currentIndex].id,
        to: this.currentStep,
      });

      logger.info(`Onboarding: moved to step ${this.currentStep}`);
    }
  }

  /**
   * Skip current step (if allowed)
   */
  skipStep(): boolean {
    const stepConfig = this.getStepConfig(this.currentStep);

    if (!stepConfig?.canSkip) {
      logger.warn(`Cannot skip required step: ${this.currentStep}`);
      return false;
    }

    logger.info(`Skipping step: ${this.currentStep}`);
    this.nextStep();
    return true;
  }

  /**
   * Validate API key for a provider
   */
  async validateAPIKey(provider: AIProvider, apiKey: string): Promise<APIKeyValidation> {
    logger.info(`Validating API key for provider: ${provider}`);

    try {
      // Basic validation: check format
      if (!apiKey || apiKey.trim().length === 0) {
        return {
          provider,
          valid: false,
          error: 'API key is empty',
        };
      }

      // Provider-specific validation
      const validation = this.validateKeyFormat(provider, apiKey);
      if (!validation.valid) {
        return validation;
      }

      // Actual API validation via test request
      logger.info(`Testing API connection for ${provider}...`);
      const connectionValid = await this.testProviderConnection(provider, apiKey);

      if (!connectionValid.valid) {
        return {
          provider,
          valid: false,
          error: connectionValid.error || 'Connection test failed',
        };
      }

      return {
        provider,
        valid: true,
        model: this.getDefaultModelForProvider(provider),
      };
    } catch (error) {
      logger.error(`API key validation failed for ${provider}:`, error as Error);
      return {
        provider,
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Test real API connection to a provider
   */
  private async testProviderConnection(
    provider: AIProvider,
    apiKey: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const endpoint = this.getTestEndpoint(provider);
      if (!endpoint) {
        return { valid: true }; // Skip for providers without known endpoint
      }

      const url = typeof endpoint.getUrl === 'function' ? endpoint.getUrl(apiKey) : endpoint.url;
      const response = await fetch(url, {
        method: endpoint.method || 'GET',
        headers: endpoint.headers
          ? typeof endpoint.headers === 'function'
            ? endpoint.headers(apiKey)
            : endpoint.headers
          : {},
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok || response.status === 200) {
        logger.info(`API connection test passed for ${provider}`);
        return { valid: true };
      }

      // 401/403 means invalid key, other errors may be temporary
      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: `Invalid API key (HTTP ${response.status})` };
      }

      // 429 is rate limit — key format is likely valid
      if (response.status === 429) {
        logger.warn(`Rate limited testing ${provider}, assuming valid`);
        return { valid: true };
      }

      return { valid: false, error: `API returned HTTP ${response.status}` };
    } catch (error: any) {
      // Network errors may be transient — warn but don't block
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        logger.warn(`Connection timeout testing ${provider}, assuming valid`);
        return { valid: true }; // Timeout is network issue, not invalid key
      }
      logger.warn(`Connection test warning for ${provider}:`, error.message);
      return { valid: true }; // Don't block setup on network errors
    }
  }

  /**
   * Get API test endpoint for provider
   */
  private getTestEndpoint(provider: AIProvider): { url: string; method: string; headers?: Record<string, string> | ((key: string) => Record<string, string>); getUrl?: (key: string) => string } | null {
    const endpoints: Record<string, any> = {
      claude: {
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: (key: string) => ({
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        }),
      },
      openai: {
        url: 'https://api.openai.com/v1/models',
        method: 'GET',
        headers: (key: string) => ({
          'Authorization': `Bearer ${key}`,
        }),
      },
      gemini: {
        url: `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent('PLACEHOLDER')}`,
        method: 'GET',
        headers: {},
        getUrl: (key: string) => `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(key)}`,
      },
      deepseek: {
        url: 'https://api.deepseek.com/v1/models',
        method: 'GET',
        headers: (key: string) => ({
          'Authorization': `Bearer ${key}`,
        }),
      },
    };

    return endpoints[provider] || null;
  }

  /**
   * Validate API key format
   */
  private validateKeyFormat(provider: AIProvider, apiKey: string): APIKeyValidation {
    const formats: Record<AIProvider, { pattern: RegExp; hint: string }> = {
      claude: {
        pattern: /^sk-ant-api\d{2}-[\w-]{95}$/,
        hint: 'Should start with sk-ant-api03-',
      },
      openai: {
        pattern: /^sk-[a-zA-Z0-9]{32,}$/,
        hint: 'Should start with sk-',
      },
      gemini: {
        pattern: /^[a-zA-Z0-9_-]{39}$/,
        hint: 'Should be 39 characters',
      },
      minimax: {
        pattern: /^[a-zA-Z0-9]{32,}$/,
        hint: 'Should be at least 32 characters',
      },
      moonshot: {
        pattern: /^sk-[a-zA-Z0-9]{32,}$/,
        hint: 'Should start with sk-',
      },
      glm: {
        pattern: /^[a-zA-Z0-9]{32,}$/,
        hint: 'Should be at least 32 characters',
      },
      deepseek: {
        pattern: /^sk-[a-zA-Z0-9]{32,}$/,
        hint: 'Should start with sk-',
      },
    };

    const format = formats[provider];
    if (!format) {
      return { provider, valid: true }; // Unknown provider, skip format check
    }

    if (!format.pattern.test(apiKey)) {
      return {
        provider,
        valid: false,
        error: `Invalid format. ${format.hint}`,
      };
    }

    return { provider, valid: true };
  }

  /**
   * Save API key
   */
  async saveAPIKey(provider: AIProvider, apiKey: string): Promise<void> {
    const authPath = join(this.dataDir, 'auth.json');

    try {
      this.configManager.setApiKey(authPath, provider, apiKey);
      this.configuredProviders.push(provider);

      this.emit('api-key-saved', { provider });
      logger.info(`API key saved for provider: ${provider}`);
    } catch (error) {
      logger.error(`Failed to save API key for ${provider}:`, error as Error);
      throw error;
    }
  }

  /**
   * Get configured providers
   */
  getConfiguredProviders(): AIProvider[] {
    return [...this.configuredProviders];
  }

  /**
   * Save model selection
   */
  async saveModelSelection(modelId: string): Promise<void> {
    const settingsPath = join(this.dataDir, 'settings.json');

    try {
      this.configManager.setSetting(settingsPath, 'model', modelId);

      this.emit('model-selected', { modelId });
      logger.info(`Default model set to: ${modelId}`);
    } catch (error) {
      logger.error('Failed to save model selection:', error as Error);
      throw error;
    }
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(data: OnboardingCompletionData): Promise<void> {
    const settingsPath = join(this.dataDir, 'settings.json');

    try {
      const settings: Partial<AgentSettings> = {
        model: data.defaultModel,
        language: data.language,
        theme: data.theme,
        onboarding: {
          completed: true,
          currentStep: ONBOARDING_STEPS.length,
          stepsCompleted: ONBOARDING_STEPS.map(s => s.id),
          skipped: false,
          completedAt: data.completedAt,
        },
      };

      this.configManager.updateSettings(settingsPath, settings);

      this.emit('onboarding-completed', data);
      logger.info('Onboarding completed successfully');
    } catch (error) {
      logger.error('Failed to complete onboarding:', error as Error);
      throw error;
    }
  }

  /**
   * Skip entire onboarding
   */
  async skipOnboarding(): Promise<void> {
    const settingsPath = join(this.dataDir, 'settings.json');

    try {
      const settings: Partial<AgentSettings> = {
        onboarding: {
          completed: true,
          currentStep: 0,
          stepsCompleted: [],
          skipped: true,
          completedAt: Date.now(),
        },
      };

      this.configManager.updateSettings(settingsPath, settings);

      this.emit('onboarding-skipped');
      logger.info('Onboarding skipped by user');
    } catch (error) {
      logger.error('Failed to skip onboarding:', error as Error);
      throw error;
    }
  }

  /**
   * Get default model for provider
   */
  private getDefaultModelForProvider(provider: AIProvider): string {
    const defaults: Record<AIProvider, string> = {
      claude: 'claude-3-7-sonnet-20250219',
      openai: 'gpt-4o',
      gemini: 'gemini-2.0-flash-exp',
      minimax: 'abab6.5-chat',
      moonshot: 'moonshot-v1-8k',
      glm: 'glm-4',
      deepseek: 'deepseek-chat',
    };

    return defaults[provider];
  }

  /**
   * Reset onboarding state
   */
  async resetOnboarding(): Promise<void> {
    const settingsPath = join(this.dataDir, 'settings.json');

    try {
      const settings: Partial<AgentSettings> = {
        onboarding: {
          completed: false,
          currentStep: 0,
          stepsCompleted: [],
          skipped: false,
        },
      };

      this.configManager.updateSettings(settingsPath, settings);

      this.currentStep = 'welcome';
      this.completedSteps = [];
      this.configuredProviders = [];

      this.emit('onboarding-reset');
      logger.info('Onboarding state reset');
    } catch (error) {
      logger.error('Failed to reset onboarding:', error as Error);
      throw error;
    }
  }
}
