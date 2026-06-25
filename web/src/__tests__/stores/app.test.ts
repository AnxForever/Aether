import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, type Message } from '@/stores/app';

function createTestMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    timestamp: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  // Reset store to initial state between tests
  useAppStore.setState({
    isAuthenticated: false,
    messages: [],
    isStreaming: false,
    sessionId: null,
    currentModel: 'claude-sonnet-4-20250514',
    sidebarOpen: true,
  });
  localStorage.clear();
});

describe('AppStore', () => {
  describe('login / logout', () => {
    it('login() sets isAuthenticated to true', () => {
      const store = useAppStore.getState();
      expect(store.isAuthenticated).toBe(false);

      useAppStore.getState().login();
      expect(useAppStore.getState().isAuthenticated).toBe(true);
    });

    it('logout() clears isAuthenticated and removes token from localStorage', () => {
      // Arrange
      localStorage.setItem('aether_token', 'some-token');
      useAppStore.setState({ isAuthenticated: true });

      // Act
      useAppStore.getState().logout();

      // Assert
      const state = useAppStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem('aether_token')).toBeNull();
    });
  });

  describe('addMessage', () => {
    it('appends a message to the messages array', () => {
      const msg1 = createTestMessage({ id: '1', content: 'Hello' });
      const msg2 = createTestMessage({ id: '2', content: 'World' });

      useAppStore.getState().addMessage(msg1);
      useAppStore.getState().addMessage(msg2);

      const messages = useAppStore.getState().messages;
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual(msg1);
      expect(messages[1]).toEqual(msg2);
    });
  });

  describe('setStreaming', () => {
    it('toggles streaming state', () => {
      expect(useAppStore.getState().isStreaming).toBe(false);

      useAppStore.getState().setStreaming(true);
      expect(useAppStore.getState().isStreaming).toBe(true);

      useAppStore.getState().setStreaming(false);
      expect(useAppStore.getState().isStreaming).toBe(false);
    });
  });

  describe('setModel', () => {
    it('updates currentModel and persists to localStorage', () => {
      useAppStore.getState().setModel('gpt-4o');

      const state = useAppStore.getState();
      expect(state.currentModel).toBe('gpt-4o');
      expect(localStorage.getItem('aether_model')).toBe('gpt-4o');
    });
  });

  describe('clearMessages', () => {
    it('resets messages and sessionId', () => {
      // Arrange
      useAppStore.getState().addMessage(createTestMessage());
      useAppStore.getState().setSessionId('session-123');
      expect(useAppStore.getState().messages).not.toHaveLength(0);
      expect(useAppStore.getState().sessionId).toBe('session-123');

      // Act
      useAppStore.getState().clearMessages();

      // Assert
      const state = useAppStore.getState();
      expect(state.messages).toHaveLength(0);
      expect(state.sessionId).toBeNull();
    });
  });

  describe('setSessionId', () => {
    it('updates the sessionId', () => {
      useAppStore.getState().setSessionId('abc-123');
      expect(useAppStore.getState().sessionId).toBe('abc-123');
    });
  });

  describe('sidebarOpen / toggleSidebar', () => {
    it('initial sidebar state is true', () => {
      expect(useAppStore.getState().sidebarOpen).toBe(true);
    });

    it('toggleSidebar flips the sidebar state', () => {
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarOpen).toBe(false);

      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarOpen).toBe(true);
    });
  });
});
