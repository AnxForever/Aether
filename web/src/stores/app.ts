import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;

  // Chat
  messages: Message[];
  isStreaming: boolean;
  sessionId: string | null;
  addMessage: (msg: Message) => void;
  setStreaming: (v: boolean) => void;
  setSessionId: (id: string) => void;
  clearMessages: () => void;

  // Model
  currentModel: string;
  setModel: (model: string) => void;

  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  isAuthenticated: !!localStorage.getItem('aether_token'),
  login: () => set({ isAuthenticated: true }),
  logout: () => {
    localStorage.removeItem('aether_token');
    set({ isAuthenticated: false });
  },

  // Chat
  messages: [],
  isStreaming: false,
  sessionId: null,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setStreaming: (v) => set({ isStreaming: v }),
  setSessionId: (id) => set({ sessionId: id }),
  clearMessages: () => set({ messages: [], sessionId: null }),

  // Model
  currentModel: localStorage.getItem('aether_model') || 'claude-sonnet-4-20250514',
  setModel: (model) => {
    localStorage.setItem('aether_model', model);
    set({ currentModel: model });
  },

  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
