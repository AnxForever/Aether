/**
 * IPC Protocol Types
 *
 * Type-safe inter-process communication
 */

// ============================================================================
// IPC Channels
// ============================================================================

export type IPCChannel =
  // Agent
  | 'agent:prompt'
  | 'agent:cancel'
  | 'agent:status'

  // Speech
  | 'speech:isReady'
  | 'speech:startStream'
  | 'speech:pushChunk'
  | 'speech:stopStream'

  // TTS
  | 'tts:synthesize'
  | 'tts:stop'
  | 'tts:listSpeakers'

  // Session
  | 'session:create'
  | 'session:list'
  | 'session:get'
  | 'session:delete'

  // Settings
  | 'settings:get'
  | 'settings:set'

  // System
  | 'system:getInfo'
  | 'system:openExternal';

export type IPCEventChannel =
  // Agent Events
  | 'agent:message'
  | 'agent:thinking'
  | 'agent:error'

  // Speech Events
  | 'speech:stream-result'
  | 'speech:final-result'

  // TTS Events
  | 'tts:started'
  | 'tts:completed';

// ============================================================================
// Request/Response Types
// ============================================================================

export interface AgentPromptRequest {
  transcript: string;
  sessionId?: string;
  stream?: boolean;
}

export interface AgentPromptResponse {
  messageId: string;
  sessionId: string;
}

export interface SpeechStreamResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
}

export interface TTSSynthesizeRequest {
  text: string;
  speaker?: string;
  language?: 'zh' | 'en';
}

// ============================================================================
// Type-safe Channel Map
// ============================================================================

export interface IPCChannelMap {
  'agent:prompt': { request: AgentPromptRequest; response: AgentPromptResponse };
  'agent:cancel': { request: void; response: void };
  'agent:status': { request: void; response: { isProcessing: boolean } };

  'speech:isReady': { request: void; response: boolean };
  'speech:startStream': { request: void; response: void };
  'speech:pushChunk': { request: ArrayBuffer; response: void };
  'speech:stopStream': { request: void; response: void };

  'tts:synthesize': { request: TTSSynthesizeRequest; response: void };
  'tts:stop': { request: void; response: void };

  'session:create': { request: { title?: string; type?: 'chat' | 'coding' }; response: any };
  'session:list': { request: void; response: any[] };

  'settings:get': { request: void; response: any };
  'settings:set': { request: { key: string; value: any }; response: void };

  'system:getInfo': { request: void; response: any };
  'system:openExternal': { request: string; response: void };
}
