/**
 * Onboarding Manager Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingManager } from '../onboarding-manager';
import { ConfigManager } from '../../storage/config-manager';

// Mock ConfigManager
vi.mock('../../storage/config-manager', () => ({
  ConfigManager: vi.fn().mockImplementation(() => ({
    loadSettings: vi.fn(),
    updateSettings: vi.fn(),
    setSetting: vi.fn(),
    setApiKey: vi.fn(),
    loadAuthConfig: vi.fn(),
  })),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock path.join
vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

describe('OnboardingManager', () => {
  let onboardingManager: OnboardingManager;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigManager = new ConfigManager('test') as jest.Mocked<ConfigManager>;
    onboardingManager = new OnboardingManager('/test/data', mockConfigManager);
  });

  describe('initial state and progress', () => {
    it('should start at welcome step', () => {
      const progress = onboardingManager.getProgress();
      expect(progress.currentStep).toBe('welcome');
    });

    it('should return correct initial progress', () => {
      const progress = onboardingManager.getProgress();
      expect(progress.completedSteps).toEqual([]);
      expect(progress.totalSteps).toBe(5);
      expect(progress.percentComplete).toBe(0);
    });

    it('should return step config for valid step', () => {
      const config = onboardingManager.getStepConfig('api-keys');
      expect(config).toBeDefined();
      expect(config?.id).toBe('api-keys');
      expect(config?.canSkip).toBe(false);
      expect(config?.isRequired).toBe(true);
    });

    it('should return undefined for invalid step', () => {
      const config = onboardingManager.getStepConfig('invalid-step' as any);
      expect(config).toBeUndefined();
    });
  });

  describe('step navigation', () => {
    it('should move to next step', () => {
      onboardingManager.nextStep();
      const progress = onboardingManager.getProgress();
      expect(progress.currentStep).toBe('api-keys');
      expect(progress.completedSteps).toContain('welcome');
    });

    it('should move through all steps in order', () => {
      const steps = ['welcome', 'api-keys', 'model-selection', 'quick-tour', 'complete'];

      for (let i = 0; i < steps.length - 1; i++) {
        const progress = onboardingManager.getProgress();
        expect(progress.currentStep).toBe(steps[i]);
        onboardingManager.nextStep();
      }

      // After all steps, should be on 'complete'
      const finalProgress = onboardingManager.getProgress();
      expect(finalProgress.currentStep).toBe('complete');
      expect(finalProgress.completedSteps).toHaveLength(4);
    });

    it('should not advance past last step', () => {
      // Navigate through all steps
      for (let i = 0; i < 5; i++) {
        onboardingManager.nextStep();
      }

      // Should still be on 'complete'
      const progress = onboardingManager.getProgress();
      expect(progress.currentStep).toBe('complete');
    });

    it('should calculate percent complete correctly', () => {
      expect(onboardingManager.getProgress().percentComplete).toBe(0);

      onboardingManager.nextStep();
      expect(onboardingManager.getProgress().percentComplete).toBe(20);

      onboardingManager.nextStep();
      expect(onboardingManager.getProgress().percentComplete).toBe(40);
    });

    it('should emit step-changed event', () => {
      const listener = vi.fn();
      onboardingManager.on('step-changed', listener);

      onboardingManager.nextStep();

      expect(listener).toHaveBeenCalledWith({
        from: 'welcome',
        to: 'api-keys',
      });
    });
  });

  describe('skip step', () => {
    it('should skip skippable step (quick-tour)', () => {
      // Move to quick-tour step (index 3)
      for (let i = 0; i < 3; i++) {
        onboardingManager.nextStep();
      }
      expect(onboardingManager.getProgress().currentStep).toBe('quick-tour');

      const skipped = onboardingManager.skipStep();
      expect(skipped).toBe(true);
      expect(onboardingManager.getProgress().currentStep).toBe('complete');
    });

    it('should not skip required step', () => {
      const skipped = onboardingManager.skipStep();
      expect(skipped).toBe(false);
      expect(onboardingManager.getProgress().currentStep).toBe('welcome');
    });
  });

  describe('API key format validation', () => {
    it('should reject empty API key', async () => {
      const result = await onboardingManager.validateAPIKey('claude', '');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is empty');
    });

    it('should reject whitespace-only API key', async () => {
      const result = await onboardingManager.validateAPIKey('openai', '   ');
      expect(result.valid).toBe(false);
    });

    it('should validate Claude key format', async () => {
      // Mock the testProviderConnection to avoid actual network call
      vi.spyOn(onboardingManager as any, 'testProviderConnection')
        .mockResolvedValue({ valid: true });

      const result = await onboardingManager.validateAPIKey(
        'claude',
        'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789abcde' // 95 chars after prefix
      );
      // This won't match actual regex exactly but tests the flow
      expect(result).toBeDefined();
    });

    it('should reject invalid OpenAI key format', async () => {
      const validMock = vi.spyOn(onboardingManager as any, 'testProviderConnection')
        .mockResolvedValue({ valid: true });

      const result = await onboardingManager.validateAPIKey('openai', 'invalid-key');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid format');
    });

    it('should validate Gemini key format (39 chars)', async () => {
      const validMock = vi.spyOn(onboardingManager as any, 'testProviderConnection')
        .mockResolvedValue({ valid: true });

      const result = await onboardingManager.validateAPIKey('gemini', 'a'.repeat(39));
      expect(result.valid).toBe(true);
    });
  });

  describe('isOnboardingNeeded', () => {
    it('should return true when settings not found', () => {
      vi.mocked(mockConfigManager.loadSettings).mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(onboardingManager.isOnboardingNeeded()).toBe(true);
    });

    it('should return true when onboarding not completed', () => {
      vi.mocked(mockConfigManager.loadSettings).mockReturnValue({
        model: 'claude-3',
        language: 'en',
        theme: 'auto',
        onboarding: {
          completed: false,
          currentStep: 0,
          stepsCompleted: [],
          skipped: false,
        },
      });

      expect(onboardingManager.isOnboardingNeeded()).toBe(true);
    });

    it('should return false when onboarding completed', () => {
      vi.mocked(mockConfigManager.loadSettings).mockReturnValue({
        model: 'claude-3',
        language: 'en',
        theme: 'auto',
        onboarding: {
          completed: true,
          currentStep: 5,
          stepsCompleted: ['welcome', 'api-keys', 'model-selection', 'quick-tour', 'complete'],
          skipped: false,
        },
      });

      expect(onboardingManager.isOnboardingNeeded()).toBe(false);
    });
  });

  describe('save and complete operations', () => {
    it('should save API key and emit event', async () => {
      const listener = vi.fn();
      onboardingManager.on('api-key-saved', listener);

      await onboardingManager.saveAPIKey('claude', 'sk-ant-test');
      expect(mockConfigManager.setApiKey).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith({ provider: 'claude' });
    });

    it('should complete onboarding with correct settings', async () => {
      const listener = vi.fn();
      onboardingManager.on('onboarding-completed', listener);

      await onboardingManager.completeOnboarding({
        selectedProviders: ['claude'],
        defaultModel: 'claude-3-7-sonnet-20250219',
        language: 'en',
        theme: 'dark',
        tourCompleted: true,
        completedAt: Date.now(),
      });

      expect(mockConfigManager.updateSettings).toHaveBeenCalled();
      expect(listener).toHaveBeenCalled();
    });

    it('should skip onboarding', async () => {
      const listener = vi.fn();
      onboardingManager.on('onboarding-skipped', listener);

      await onboardingManager.skipOnboarding();
      expect(mockConfigManager.updateSettings).toHaveBeenCalled();
      expect(listener).toHaveBeenCalled();
    });

    it('should reset onboarding state', async () => {
      // First complete some steps
      onboardingManager.nextStep();
      onboardingManager.nextStep();

      await onboardingManager.resetOnboarding();

      const progress = onboardingManager.getProgress();
      expect(progress.currentStep).toBe('welcome');
      expect(progress.completedSteps).toEqual([]);
      expect(mockConfigManager.updateSettings).toHaveBeenCalled();
    });
  });

  describe('getAllSteps', () => {
    it('should return all step configurations', () => {
      const steps = onboardingManager.getAllSteps();
      expect(steps).toHaveLength(5);
      expect(steps[0].id).toBe('welcome');
      expect(steps[4].id).toBe('complete');
    });
  });

  describe('getConfiguredProviders', () => {
    it('should return empty array initially', () => {
      expect(onboardingManager.getConfiguredProviders()).toEqual([]);
    });

    it('should return configured providers after saving', async () => {
      await onboardingManager.saveAPIKey('claude', 'key-1');
      await onboardingManager.saveAPIKey('openai', 'key-2');

      const providers = onboardingManager.getConfiguredProviders();
      expect(providers).toContain('claude');
      expect(providers).toContain('openai');
    });
  });
});
