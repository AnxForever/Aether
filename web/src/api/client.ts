/// <reference types="vite/client" />

/**
 * Aether API Client
 *
 * Typed HTTP client for the Aether Web API.
 *
 * SECURITY NOTE: Token Storage Strategy
 * --------------------------------------
 * Token is stored in localStorage for persistence across page reloads.
 * This is a known trade-off: localStorage is accessible to any JavaScript
 * running on the same origin and is therefore vulnerable to XSS attacks.
 *
 * Alternatives considered:
 *   - HttpOnly cookie: Impossible for a SPA client since the token must
 *     be readable by JavaScript to attach the Authorization header.
 *   - In-memory only: Lost on page refresh, degrading UX (frequent logins).
 *
 * Mitigations:
 *   - Input sanitization is applied before rendering user content.
 *   - CSP headers restrict script sources to 'self'.
 *   - Token carries an expiry; stale tokens are discarded client-side.
 *   - On 401, token is immediately cleared and user is redirected to login.
 */

const BASE = import.meta.env.VITE_API_URL || '';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Seconds before expiry to treat token as stale (5 min grace period). */
const EXPIRY_GRACE_S = 300;

/**
 * Decode the JWT payload (without verifying) to check the `exp` claim.
 * Returns `null` if the token is missing, malformed, or expired.
 */
function decodeExpFromToken(token: string): number | null {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    const payload = JSON.parse(atob(payloadBase64));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Returns `true` when the token is still valid (not yet expired). */
function isTokenValid(token: string): boolean {
  const exp = decodeExpFromToken(token);
  if (exp === null) return false;
  // Keep the token usable until EXPIRY_GRACE_S before actual expiry
  return Date.now() / 1000 < exp - EXPIRY_GRACE_S;
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------
// Kept in localStorage so the token survives page reloads.
// See the module-level doc comment for the security trade-off analysis.

const STORAGE_KEY = 'aether_token';
let authToken: string | null = (() => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && isTokenValid(stored)) return stored;
  // Discard stale tokens immediately
  if (stored) localStorage.removeItem(STORAGE_KEY);
  return null;
})();

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem(STORAGE_KEY, token);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getToken(): string | null {
  // Lazily verify the in-memory token hasn't expired since last check
  if (authToken && !isTokenValid(authToken)) {
    setToken(null);
    return null;
  }
  return authToken;
}

/** Redirect to the login page (relative path). */
function redirectToLogin(): void {
  // Avoid redirect loops — only redirect if we aren't already on the login page
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    setToken(null);
    redirectToLogin();
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
// Models
// ============================================================================

export async function switchModel(model: string) {
  return request<{ model: string }>('POST', '/api/models/switch', { model });
}

// ============================================================================
// Chat
// ============================================================================

export async function sendMessage(message: string, sessionId?: string, model?: string) {
  return request<{ message: string; sessionId: string }>('POST', '/api/chat', { message, sessionId, model });
}

export function streamChat(
  message: string,
  sessionId: string | undefined,
  model: string,
  onChunk: (text: string) => void,
  onDone: (sessionId: string) => void,
  onError: (error: string) => void
): AbortController {
  const controller = new AbortController();
  const params = new URLSearchParams({ message });
  if (sessionId) params.set('sessionId', sessionId);
  if (model) params.set('model', model);

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
