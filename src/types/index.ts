/**
 * Aether Core Types
 *
 * Complete type system for Aether
 */

// ============================================================================
// Core Agent Types
// ============================================================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, any> }>;
}

export interface Session {
  id: string;
  title: string;
  type: 'chat' | 'coding';
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

export interface AgentContext {
  sessionId: string;
  userId?: string;
  deviceId: string;
  settings: AgentSettings;
  capabilities: string[];
}

export interface AgentSettings {
  model: string;
  temperature?: number;
  maxTokens?: number;
  streamResponse?: boolean;
  language: 'en' | 'zh';
  theme: 'light' | 'dark' | 'auto';
  onboarding?: OnboardingState;
}

export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  stepsCompleted: string[];
  skipped: boolean;
  completedAt?: number;
}

// ============================================================================
// AI Provider Types
// ============================================================================

export type AIProvider =
  | 'claude'
  | 'openai'
  | 'gemini'
  | 'minimax'
  | 'moonshot'
  | 'glm'
  | 'deepseek';

export interface ModelConfig {
  id: string;
  name: string;
  provider: AIProvider;
  contextWindow: number;
  maxOutput: number;
  inputPrice: number;  // per 1M tokens
  outputPrice: number; // per 1M tokens
  capabilities: ModelCapability[];
}

export type ModelCapability =
  | 'text'
  | 'vision'
  | 'function-calling'
  | 'streaming'
  | 'json-mode';

export interface StreamChunk {
  type: 'text' | 'tool-call' | 'thinking' | 'error';
  content: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Tool & Skill Types
// ============================================================================

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  handler: ToolHandler;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  schema?: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[] | Record<string, any>; // Support both array and JSON Schema format
  implementation?: string; // Code as string (optional for declarative tools)
}

export type ToolHandler = (params: Record<string, any>) => Promise<ToolResult>;

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  tools: Tool[];
  enabled: boolean;
  execute?: (args: string, context: Record<string, unknown>) => Promise<ToolResult>;
}

// ============================================================================
// Cycle & Pipeline Types
// ============================================================================

export interface Cycle {
  id: string;
  sessionId: string;
  input: UserInput;
  context: AgentContext;
  startTime: number;
  endTime?: number;
  status: CycleStatus;
}

export type CycleStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface UserInput {
  transcript: string;
  attachments?: Attachment[];
  metadata?: Record<string, any>;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio';
  url: string;
  size: number;
  mimeType: string;
}

export interface PipelineStage {
  name: string;
  execute: (data: any) => Promise<any>;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StorageConfig {
  dbPath: string;
  encryptionKey: Buffer;
  walMode: boolean;
}

export interface ConfigData {
  auth: AuthConfig;
  models: ModelConfig[];
  settings: AgentSettings;
}

export interface AuthConfig {
  apiKeys: Record<AIProvider, string>;
  tokens: Record<string, string>;
}

// ============================================================================
// Event Types
// ============================================================================

export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  data: any;
}

export type AgentEventType =
  | 'agent:start'
  | 'agent:stop'
  | 'turn:start'
  | 'turn:end'
  | 'message:start'
  | 'message:chunk'
  | 'message:end'
  | 'tool:call'
  | 'tool:result'
  | 'error';

// ============================================================================
// Queue Types
// ============================================================================

export interface Task {
  id: string;
  priority: 'primary' | 'background';
  handler: () => Promise<void>;
  createdAt: number;
}

export interface Queue {
  enqueue(task: Task): void;
  dequeue(): Task | undefined;
  size(): number;
  clear(): void;
}
