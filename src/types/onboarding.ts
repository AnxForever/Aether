/**
 * Onboarding Types
 */

import { AIProvider } from './index';

/**
 * Onboarding step identifier
 */
export type OnboardingStep =
  | 'welcome'
  | 'api-keys'
  | 'model-selection'
  | 'quick-tour'
  | 'complete';

/**
 * Onboarding progress data
 */
export interface OnboardingProgress {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  totalSteps: number;
  percentComplete: number;
}

/**
 * API key validation result
 */
export interface APIKeyValidation {
  provider: AIProvider;
  valid: boolean;
  error?: string;
  model?: string;
}

/**
 * Onboarding completion data
 */
export interface OnboardingCompletionData {
  selectedProviders: AIProvider[];
  defaultModel: string;
  language: 'en' | 'zh';
  theme: 'light' | 'dark' | 'auto';
  tourCompleted: boolean;
  completedAt: number;
}

/**
 * Onboarding step configuration
 */
export interface OnboardingStepConfig {
  id: OnboardingStep;
  title: string;
  description: string;
  canSkip: boolean;
  isRequired: boolean;
  estimatedTime: number; // seconds
}
