/**
 * Mini Window Renderer - Frontend logic for mini floating window
 */

/// <reference lib="dom" />

import { createLogger } from '../utils/logger';

const logger = createLogger('MiniWindow:Renderer');

/**
 * Declare window.electron API
 */
declare global {
  interface Window {
    electron: {
      send: (channel: string, data: any) => void;
      on: (channel: string, callback: (data: any) => void) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, listener: (...args: any[]) => void) => void;
      };
    };
  }
}

/**
 * Mini Window State
 */
interface MiniWindowState {
  input: string;
  isProcessing: boolean;
  recentChats: string[];
}

/**
 * Mini Window Renderer
 */
export class MiniWindowRenderer {
  private state: MiniWindowState = {
    input: '',
    isProcessing: false,
    recentChats: []
  };

  private inputElement?: HTMLInputElement;
  private containerElement?: HTMLDivElement;

  /**
   * Initialize renderer
   */
  initialize(): void {
    this.setupDOM();
    this.bindEvents();
    this.loadRecentChats();

    logger.info('Mini window renderer initialized');
  }

  /**
   * Setup DOM elements
   */
  private setupDOM(): void {
    // Create container
    this.containerElement = document.createElement('div');
    this.containerElement.className = 'mini-window-container';
    this.containerElement.innerHTML = `
      <div class="mini-window-content">
        <input
          type="text"
          class="mini-input"
          placeholder="Ask Aether anything..."
          autocomplete="off"
        />
        <div class="mini-actions">
          <button class="mini-btn mini-btn-send" title="Send">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 2l14 6-14 6V9l10-1L1 7V2z"/>
            </svg>
          </button>
          <button class="mini-btn mini-btn-new" title="New Chat">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.containerElement);

    // Get input element
    this.inputElement = this.containerElement.querySelector('.mini-input') as HTMLInputElement;
  }

  /**
   * Bind event listeners
   */
  private bindEvents(): void {
    if (!this.inputElement) return;

    // Input change
    this.inputElement.addEventListener('input', (e) => {
      this.state.input = (e.target as HTMLInputElement).value;
    });

    // Enter key to send
    this.inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Send button
    const sendBtn = this.containerElement?.querySelector('.mini-btn-send');
    sendBtn?.addEventListener('click', () => this.handleSend());

    // New chat button
    const newBtn = this.containerElement?.querySelector('.mini-btn-new');
    newBtn?.addEventListener('click', () => this.handleNewChat());

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.close();
      }
    });
  }

  /**
   * Handle send message
   */
  private async handleSend(): Promise<void> {
    if (!this.state.input.trim() || this.state.isProcessing) return;

    this.state.isProcessing = true;
    const message = this.state.input;

    try {
      // Send to main process via IPC
      await window.electron.ipcRenderer.invoke('mini-window:send-message', message);

      // Add to recent chats
      this.state.recentChats.unshift(message);
      this.state.recentChats = this.state.recentChats.slice(0, 10);
      this.saveRecentChats();

      // Clear input
      this.state.input = '';
      if (this.inputElement) {
        this.inputElement.value = '';
      }

      // Open main window to show response
      await window.electron.ipcRenderer.invoke('window:show-main');

      logger.info('Message sent from mini window');
    } catch (error) {
      logger.error('Failed to send message:', error as Error);
    } finally {
      this.state.isProcessing = false;
    }
  }

  /**
   * Handle new chat
   */
  private async handleNewChat(): Promise<void> {
    try {
      await window.electron.ipcRenderer.invoke('chat:new');
      await window.electron.ipcRenderer.invoke('window:show-main');
      logger.info('New chat created from mini window');
    } catch (error) {
      logger.error('Failed to create new chat:', error as Error);
    }
  }

  /**
   * Load recent chats from storage
   */
  private async loadRecentChats(): Promise<void> {
    try {
      const recent = await window.electron.ipcRenderer.invoke('storage:get', 'mini-window:recent-chats');
      if (recent) {
        this.state.recentChats = JSON.parse(recent);
      }
    } catch (error) {
      logger.error('Failed to load recent chats:', error as Error);
    }
  }

  /**
   * Save recent chats to storage
   */
  private async saveRecentChats(): Promise<void> {
    try {
      await window.electron.ipcRenderer.invoke(
        'storage:set',
        'mini-window:recent-chats',
        JSON.stringify(this.state.recentChats)
      );
    } catch (error) {
      logger.error('Failed to save recent chats:', error as Error);
    }
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const renderer = new MiniWindowRenderer();
    renderer.initialize();
  });
}
