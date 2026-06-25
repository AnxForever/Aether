/// <reference types="vite/client" />

/**
 * Aether API Client
 *
 * Typed HTTP client for the Aether Web API.
 */

const BASE = import.meta.env.VITE_API_URL || '';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

let authToken: string | null = localStorage.getItem('aether_token');

export function setToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem('aether_token', token);
  else localStorage.removeItem('aether_token');
}

export function getToken(): string | null {
  return authToken;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    setToken(null);
  }

  return res.json();
}

// ============================================================================
// Auth
// ============================================================================

export async function login(username: string, password: string) {
  const res = await request<{ token: string; expiresIn: number }>('POST', '/api/auth/login', { username, password });
  if (res.success && res.data?.token) setToken(res.data.token);
  return res;
}

// ============================================================================
// Chat
// ============================================================================

export async function sendMessage(message: string, sessionId?: string) {
  return request<{ message: string; sessionId: string }>('POST', '/api/chat', { message, sessionId });
}

export function streamChat(
  message: string,
  sessionId: string | undefined,
  onChunk: (text: string) => void,
  onDone: (sessionId: string) => void,
  onError: (error: string) => void
): AbortController {
  const controller = new AbortController();
  const params = new URLSearchParams({ message });
  if (sessionId) params.set('sessionId', sessionId);

  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  fetch(`${BASE}/api/chat/stream?${params}`, { headers, signal: controller.signal })
    .then(async (res) => {
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') onChunk(data.content);
              else if (data.type === 'done') onDone(data.sessionId);
              else if (data.type === 'error') onError(data.error);
            } catch { /* skip malformed */ }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') onError(err.message);
    });

  return controller;
}

// ============================================================================
// Models
// ============================================================================

export async function getModels() {
  return request<{ models: unknown[]; count: number }>('GET', '/api/models');
}

// ============================================================================
// Skills
// ============================================================================

export async function getSkills() {
  return request<{ skills: unknown[]; dynamicSkills: unknown[]; count: number }>('GET', '/api/skills');
}

export async function toggleSkill(id: string, enabled: boolean) {
  return request<{ id: string; enabled: boolean }>('POST', `/api/skills/${id}/toggle`, { enabled });
}

// ============================================================================
// Learning
// ============================================================================

export async function submitFeedback(messageId: string, rating: number, comment?: string) {
  return request<{ feedbackId: string }>('POST', '/api/learning/feedback', { messageId, rating, comment });
}

export async function getLearningStats() {
  return request('GET', '/api/learning/stats');
}

// ============================================================================
// Workflows
// ============================================================================

export async function getWorkflows() {
  return request<{ workflows: unknown[]; count: number }>('GET', '/api/workflows');
}

export async function runWorkflow(id: string, inputs?: Record<string, unknown>) {
  return request('POST', `/api/workflows/${id}/run`, { inputs });
}

// ============================================================================
// Session
// ============================================================================

export async function newSession() {
  return request<{ sessionId: string }>('POST', '/api/session/new');
}
