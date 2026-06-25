/**
 * Aether Main Window - Application Logic
 *
 * Handles: sessions, chat streaming, model/mode switching,
 * keyboard shortcuts, settings, export.
 */

(function () {
  'use strict';

  // ============================================================
  // State
  // ============================================================
  const state = {
    sessions: [],
    currentSessionId: null,
    messages: [],
    currentModel: null,
    currentMode: 'chat',
    isStreaming: false,
    settings: {
      theme: 'auto',
      language: 'en',
      temperature: 0.7,
      streamResponse: true,
    },
    exportFormat: 'markdown',
    sidebarCollapsed: false,
  };

  // ============================================================
  // Model catalog (mirrors onboarding defaults)
  // ============================================================
  const PROVIDER_COLORS = {
    claude: '#D97757',
    openai: '#10A37F',
    gemini: '#4285F4',
    minimax: '#FF6B35',
    moonshot: '#6366F1',
    glm: '#3B82F6',
    deepseek: '#4D6BFE',
  };

  const MODEL_CATALOG = {
    claude: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', features: '200K · Vision · Fast' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', features: '200K · Best reasoning' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', features: 'Fast · Cost-effective' },
    ],
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o', features: '128K · Vision · Multimodal' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', features: '128K · Function calling' },
    ],
    gemini: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', features: '1M · Multimodal · Fast' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', features: '2M · Vision' },
    ],
    minimax: [
      { id: 'abab6.5-chat', name: 'abab6.5 Chat', features: 'Chinese · 8K' },
    ],
    moonshot: [
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', features: 'Chinese · 8K' },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', features: 'Chinese · 128K' },
    ],
    glm: [
      { id: 'glm-4', name: 'GLM-4', features: 'Chinese · 128K' },
    ],
    deepseek: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', features: 'Code · 32K' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', features: 'Code · 128K' },
    ],
  };

  // ============================================================
  // Element refs
  // ============================================================
  const el = {
    sidebar: document.getElementById('sidebar'),
    collapseSidebar: document.getElementById('collapseSidebar'),
    toggleSidebar: document.getElementById('toggleSidebar'),
    newChatBtn: document.getElementById('newChatBtn'),
    searchInput: document.getElementById('searchInput'),
    sessionsList: document.getElementById('sessionsList'),
    settingsBtn: document.getElementById('settingsBtn'),
    modelBtn: document.getElementById('modelBtn'),
    modelDropdown: document.getElementById('modelDropdown'),
    currentModel: document.getElementById('currentModel'),
    providerDot: document.getElementById('providerDot'),
    modeSwitch: document.getElementById('modeSwitch'),
    exportBtn: document.getElementById('exportBtn'),
    messages: document.getElementById('messages'),
    emptyState: document.getElementById('emptyState'),
    suggestions: document.getElementById('suggestions'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    charCount: document.getElementById('charCount'),
    // Modals
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    themeSelect: document.getElementById('themeSelect'),
    languageSelect: document.getElementById('languageSelect'),
    tempSlider: document.getElementById('tempSlider'),
    tempValue: document.getElementById('tempValue'),
    streamToggle: document.getElementById('streamToggle'),
    exportModal: document.getElementById('exportModal'),
    closeExport: document.getElementById('closeExport'),
    exportFormat: document.getElementById('exportFormat'),
    doExport: document.getElementById('doExport'),
  };

  // ============================================================
  // API helper (uses exposed electronAPI / nexus)
  // ============================================================
  const api = window.electronAPI || window.nexus;

  async function callApi(fn, ...args) {
    if (!api || typeof fn !== 'function') {
      console.warn('API not available (running outside Electron?)');
      return null;
    }
    try {
      return await fn(...args);
    } catch (err) {
      console.error('API call failed:', err);
      throw err;
    }
  }

  // ============================================================
  // Initialization
  // ============================================================
  async function init() {
    applyTheme(state.settings.theme);
    bindEvents();
    await loadThemeFromBackend();
    await loadSettings();
    await loadSessions();
    buildModelDropdown();
    if (!state.currentModel) {
      state.currentModel = MODEL_CATALOG.claude[0];
      updateModelDisplay();
    }
    autoResizeTextarea();
    updateCharCount();
  }

  // ============================================================
  // Event binding
  // ============================================================
  function bindEvents() {
    // Sidebar
    el.collapseSidebar.addEventListener('click', toggleSidebar);
    el.toggleSidebar.addEventListener('click', toggleSidebar);
    el.newChatBtn.addEventListener('click', createNewSession);

    // Search
    el.searchInput.addEventListener('input', filterSessions);

    // Model selector
    el.modelBtn.addEventListener('click', toggleModelDropdown);
    document.addEventListener('click', (e) => {
      if (!el.modelSelector.contains(e.target)) {
        el.modelDropdown.classList.add('hidden');
      }
    });
    const modelSelector = document.querySelector('.model-selector');

    // Mode switch
    el.modeSwitch.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    // Suggestions
    el.suggestions.addEventListener('click', (e) => {
      const card = e.target.closest('.suggestion-card');
      if (card) {
        el.messageInput.value = card.dataset.prompt;
        updateCharCount();
        autoResizeTextarea();
        sendMessage();
      }
    });

    // Composer
    el.messageInput.addEventListener('input', () => {
      updateCharCount();
      autoResizeTextarea();
    });
    el.messageInput.addEventListener('keydown', handleInputKeydown);
    el.sendBtn.addEventListener('click', sendMessage);

    // Export
    el.exportBtn.addEventListener('click', () => el.exportModal.classList.remove('hidden'));
    el.closeExport.addEventListener('click', () => el.exportModal.classList.add('hidden'));
    el.exportFormat.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        el.exportFormat.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.exportFormat = btn.dataset.format;
      });
    });
    el.doExport.addEventListener('click', exportConversation);

    // Settings
    el.settingsBtn.addEventListener('click', () => el.settingsModal.classList.remove('hidden'));
    el.closeSettings.addEventListener('click', () => el.settingsModal.classList.add('hidden'));
    el.themeSelect.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        el.themeSelect.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.settings.theme = btn.dataset.theme;
        applyTheme(state.settings.theme);
        saveSettings();
      });
    });
    el.languageSelect.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        el.languageSelect.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.settings.language = btn.dataset.lang;
        saveSettings();
      });
    });
    el.tempSlider.addEventListener('input', (e) => {
      state.settings.temperature = parseFloat(e.target.value);
      el.tempValue.textContent = state.settings.temperature.toFixed(1);
    });
    el.tempSlider.addEventListener('change', saveSettings);
    el.streamToggle.addEventListener('change', (e) => {
      state.settings.streamResponse = e.target.checked;
      saveSettings();
    });

    // Global shortcuts (renderer-side, when window focused)
    document.addEventListener('keydown', handleGlobalKeydown);

    // Close modals on overlay click
    el.settingsModal.addEventListener('click', (e) => {
      if (e.target === el.settingsModal) el.settingsModal.classList.add('hidden');
    });
    el.exportModal.addEventListener('click', (e) => {
      if (e.target === el.exportModal) el.exportModal.classList.remove('hidden');
    });

    // Fix scope for model selector click handler
    if (modelSelector) {
      modelSelector.addEventListener('click', (e) => e.stopPropagation());
    }
  }

  // ============================================================
  // Keyboard shortcuts
  // ============================================================
  function handleGlobalKeydown(e) {
    const mod = e.metaKey || e.ctrlKey;

    // Cmd/Ctrl+K — cycle model
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      cycleModel();
      return;
    }

    // Cmd/Ctrl+N — new chat
    if (mod && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      createNewSession();
      return;
    }

    // Cmd/Ctrl+B — toggle sidebar
    if (mod && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    // Cmd/Ctrl+Slash — focus search
    if (mod && e.key === '/') {
      e.preventDefault();
      el.searchInput.focus();
      return;
    }

    // Cmd/Ctrl+, — settings
    if (mod && e.key === ',') {
      e.preventDefault();
      el.settingsModal.classList.remove('hidden');
      return;
    }

    // Escape — close modals / dropdown
    if (e.key === 'Escape') {
      el.settingsModal.classList.add('hidden');
      el.exportModal.classList.add('hidden');
      el.modelDropdown.classList.add('hidden');
    }
  }

  function handleInputKeydown(e) {
    const mod = e.metaKey || e.ctrlKey;
    // Cmd/Ctrl+Enter to send
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
      return;
    }
    // Enter to send (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      return;
    }
  }

  // ============================================================
  // Theme
  // ============================================================
  function applyTheme(theme) {
    const resolved = theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.setAttribute('data-theme', resolved);
    // Also sync to backend
    if (api && api.saveTheme) {
      callApi(api.saveTheme, { mode: theme }).catch(() => {});
    }
  }

  async function loadThemeFromBackend() {
    try {
      const result = await callApi(api.loadTheme);
      if (result && result.theme && result.theme.mode) {
        state.settings.theme = result.theme.mode;
        applyTheme(state.settings.theme);
        // Update UI
        el.themeSelect.querySelectorAll('button').forEach(b => {
          b.classList.toggle('active', b.dataset.theme === state.settings.theme);
        });
      }
    } catch (err) { /* use localStorage fallback */ }
  }

  // ============================================================
  // Notifications / Toasts
  // ============================================================
  function showToast(title, description, type, duration) {
    type = type || 'info';
    duration = duration || 4000;
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <div class="toast-body">
        <div class="toast-title">${escapeHtml(title || '')}</div>
        ${description ? '<div class="toast-desc">' + escapeHtml(description) + '</div>' : ''}
      </div>
      <button class="toast-close">&times;</button>
    `;
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.style.animation = 'slideOut 0.2s ease-in forwards';
      setTimeout(() => toast.remove(), 200);
    });
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.2s ease-in forwards';
      setTimeout(() => { if (toast.parentElement) toast.remove(); }, 200);
    }, duration);
  }

  // Listen for notification events from main process
  if (api && api.on) {
    // Try to listen for notification-show events
    try { api.on('event:notification-show', (n) => showToast(n.title, n.description, n.type, n.duration)); } catch(e) {}
  }

  // ============================================================
  // Sessions
  // ============================================================
  async function loadSessions() {
    try {
      const result = await callApi(api.listSessions);
      state.sessions = (result && result.sessions) || [];
    } catch (err) {
      state.sessions = [];
    }
    renderSessions();
  }

  function renderSessions(filter = '') {
    el.sessionsList.innerHTML = '';
    const lower = filter.toLowerCase();
    const filtered = state.sessions.filter(s =>
      !filter || (s.title && s.title.toLowerCase().includes(lower))
    );

    if (filtered.length === 0) {
      el.sessionsList.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">${
        filter ? 'No matching conversations' : 'No conversations yet'
      }</div>`;
      return;
    }

    for (const session of filtered) {
      const item = document.createElement('div');
      item.className = 'session-item' + (session.id === state.currentSessionId ? ' active' : '');
      item.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span class="session-title">${escapeHtml(session.title || 'New Chat')}</span>
      `;
      item.addEventListener('click', () => loadSession(session.id));
      el.sessionsList.appendChild(item);
    }
  }

  let searchTimeout = null;
  let searchResultsPanel = null;

  function filterSessions() {
    const query = el.searchInput.value.trim();
    clearTimeout(searchTimeout);

    if (!query) {
      renderSessions('');
      hideSearchResults();
      return;
    }

    // Debounced full-text search via backend
    searchTimeout = setTimeout(async () => {
      try {
        const result = await callApi(api.searchConversations, query, 8);
        if (result && result.results) {
          showSearchResults(result.results, query);
        } else {
          // Fallback to local title filtering
          renderSessions(query);
          hideSearchResults();
        }
      } catch (err) {
        // Fallback to local title filtering
        renderSessions(query);
        hideSearchResults();
      }
    }, 250);
  }

  function showSearchResults(results, query) {
    // Hide normal session list, show search results dropdown
    hideSearchResults();
    searchResultsPanel = document.createElement('div');
    searchResultsPanel.className = 'search-results-panel';
    searchResultsPanel.innerHTML = `<div class="search-results-header">Results for "${escapeHtml(query)}" (${results.length})</div>`;

    for (const r of results) {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      const preview = r.content ? r.content.substring(0, 120) + '...' : '';
      let highlighted = escapeHtml(preview);
      if (query) {
        const re = new RegExp(`(${escapeRegex(query)})`, 'gi');
        highlighted = highlighted.replace(re, '<mark>$1</mark>');
      }
      item.innerHTML = `
        <div class="search-result-score">${Math.round(r.score * 100)}%</div>
        <div class="search-result-preview">${highlighted}</div>
      `;
      item.addEventListener('click', () => {
        if (r.metadata && r.metadata.sessionId) {
          loadSession(r.metadata.sessionId);
        }
        hideSearchResults();
        el.searchInput.value = '';
        renderSessions('');
      });
      searchResultsPanel.appendChild(item);
    }
    el.sessionsList.parentElement.appendChild(searchResultsPanel);
    el.sessionsList.style.display = 'none';
  }

  function hideSearchResults() {
    if (searchResultsPanel) {
      searchResultsPanel.remove();
      searchResultsPanel = null;
    }
    el.sessionsList.style.display = '';
  }

  function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async function createNewSession() {
    try {
      const result = await callApi(api.newSession);
      if (result && result.sessionId) {
        state.currentSessionId = result.sessionId;
        state.messages = [];
        await loadSessions();
        renderMessages();
        el.messageInput.focus();
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  }

  async function loadSession(sessionId) {
    state.currentSessionId = sessionId;
    try {
      const result = await callApi(api.getSession, sessionId);
      if (result && result.session) {
        state.messages = result.session.messages || [];
        renderMessages();
        renderSessions(el.searchInput.value);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }

  // ============================================================
  // Messages
  // ============================================================
  function renderMessages() {
    el.messages.innerHTML = '';
    if (state.messages.length === 0) {
      el.messages.appendChild(el.emptyState);
      return;
    }

    for (const msg of state.messages) {
      el.messages.appendChild(renderMessage(msg));
    }
    scrollToBottom();
  }

  function renderMessage(msg) {
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    const avatar = msg.role === 'user' ? 'You' : 'Æ';
    const roleLabel = msg.role === 'user' ? 'You' : 'Aether';

    div.innerHTML = `
      <div class="message-avatar">${escapeHtml(avatar)}</div>
      <div class="message-content">
        <div class="message-role">${escapeHtml(roleLabel)}</div>
        <div class="message-text">${formatMessage(msg.content)}</div>
        <div class="message-actions">
          <button class="message-action" data-action="copy-msg">Copy All</button>
          ${msg.role === 'assistant' ? '<button class="message-action" data-action="regenerate">Regenerate</button>' : ''}
        </div>
      </div>
    `;

    // Wire up code block copy buttons
    div.querySelectorAll('.cb-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        navigator.clipboard.writeText(code).then(() => {
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        });
      });
    });

    // Copy full message
    div.querySelector('[data-action="copy-msg"]').addEventListener('click', () => {
      navigator.clipboard.writeText(msg.content);
      showToast('Copied', 'Message copied to clipboard', 'success', 2000);
    });
    const regen = div.querySelector('[data-action="regenerate"]');
    if (regen) {
      regen.addEventListener('click', () => regenerateLast());
    }

    return div;
  }

  function formatMessage(content) {
    let html = escapeHtml(content);
    // Code blocks with language label + copy button
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const langLabel = lang ? `<span class="cb-lang">${lang}</span>` : '';
      const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const highlighted = highlightCode(escapedCode, lang || 'plaintext');
      return `<div class="code-block">` +
        `<div class="cb-header">${langLabel}<button class="cb-copy-btn" data-code="${escapedCode.replace(/"/g, '&quot;')}">Copy</button></div>` +
        `<pre><code class="language-${lang || 'plaintext'}">${highlighted}</code></pre>` +
        `</div>`;
    });
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  // Basic keyword highlighter for common languages
  function highlightCode(code, lang) {
    const keywords = {
      javascript: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof|true|false|null|undefined)\b/g,
      typescript: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof|true|false|null|undefined|type|interface|enum|readonly|as|is|keyof|infer|extends|implements)\b/g,
      python: /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|finally|raise|with|yield|lambda|True|False|None|and|or|not|in|is|pass|break|continue|self|async|await)\b/g,
      go: /\b(func|return|if|else|for|range|var|const|type|struct|interface|map|chan|go|select|defer|import|package|true|false|nil|break|continue|switch|case|default|error|string|int|bool|byte|float64)\b/g,
      rust: /\b(fn|let|mut|return|if|else|for|while|loop|match|struct|impl|trait|enum|pub|use|mod|crate|self|super|where|as|in|ref|move|async|await|true|false|Some|None|Ok|Err|Result|Option|Vec|String|i32|i64|u32|u64|bool|char|f32|f64)\b/g,
      bash: /\b(echo|cd|ls|mkdir|rm|cp|mv|cat|grep|sed|awk|export|source|chmod|if|then|else|fi|for|do|done|while|case|esac|exit|return|function|alias|unset)\b/g,
      sql: /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|ON|AND|OR|NOT|IN|LIKE|ORDER|BY|GROUP|HAVING|LIMIT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|VIEW|DROP|ALTER|AS|DISTINCT|COUNT|SUM|AVG|MAX|MIN|NULL|IS|TRUE|FALSE|PRIMARY|KEY|FOREIGN|REFERENCES)\b/gi,
      json: /\b(true|false|null)\b/g,
    };
    const builtins = {
      javascript: /\b(console|Math|JSON|Promise|Array|Object|String|Number|Boolean|Date|RegExp|Error|Map|Set|parseInt|parseFloat|isNaN)\b/g,
      python: /\b(print|len|range|enumerate|zip|map|filter|sorted|reversed|list|dict|set|tuple|str|int|float|bool|type|isinstance|hasattr|getattr|setattr|open|input|format)\b/g,
    };
    const comments = /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/)/gm;
    const strings = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
    const numbers = /\b(\d+\.?\d*)\b/g;

    // Highlight strings (must come before keywords)
    code = code.replace(strings, '<span class="hl-string">$1</span>');
    // Highlight comments
    code = code.replace(comments, '<span class="hl-comment">$1</span>');
    // Highlight keywords
    if (keywords[lang]) code = code.replace(keywords[lang], '<span class="hl-keyword">$1</span>');
    else if (keywords.javascript) code = code.replace(keywords.javascript, '<span class="hl-keyword">$1</span>');
    // Highlight builtins
    if (builtins[lang]) code = code.replace(builtins[lang], '<span class="hl-builtin">$1</span>');
    // Highlight numbers
    code = code.replace(numbers, '<span class="hl-number">$1</span>');

    return code;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function scrollToBottom() {
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  // ============================================================
  // Send message
  // ============================================================
  async function sendMessage() {
    const text = el.messageInput.value.trim();
    if (!text || state.isStreaming) return;

    // Add user message
    const userMsg = { role: 'user', content: text, timestamp: Date.now() };
    state.messages.push(userMsg);

    // Clear input
    el.messageInput.value = '';
    updateCharCount();
    autoResizeTextarea();

    // Hide empty state, render
    if (el.emptyState.parentElement) el.emptyState.remove();
    el.messages.appendChild(renderMessage(userMsg));
    scrollToBottom();

    // Show typing indicator
    const typingEl = document.createElement('div');
    typingEl.className = 'message assistant';
    typingEl.innerHTML = `
      <div class="message-avatar">Æ</div>
      <div class="message-content">
        <div class="message-role">Aether</div>
        <div class="message-text">
          <div class="typing-indicator"><span></span><span></span><span></span></div>
        </div>
      </div>
    `;
    el.messages.appendChild(typingEl);
    scrollToBottom();

    state.isStreaming = true;
    el.sendBtn.disabled = true;

    try {
      if (state.settings.streamResponse) {
        await streamChat(text);
      } else {
        const response = await callApi(api.sendMessage, text, state.currentSessionId);
        typingEl.remove();
        const assistantMsg = {
          role: 'assistant',
          content: (response && response.message && response.message.content) || 'No response received.',
          timestamp: Date.now(),
        };
        state.messages.push(assistantMsg);
        el.messages.appendChild(renderMessage(assistantMsg));
        scrollToBottom();
      }
    } catch (err) {
      typingEl.remove();
      const errMsg = {
        role: 'assistant',
        content: `⚠️ Error: ${err.message || 'Failed to get response'}`,
        timestamp: Date.now(),
      };
      state.messages.push(errMsg);
      el.messages.appendChild(renderMessage(errMsg));
      scrollToBottom();
    } finally {
      state.isStreaming = false;
      el.sendBtn.disabled = false;
    }
  }

  async function streamChat(text) {
    // Build a streaming assistant bubble
    const assistantEl = document.createElement('div');
    assistantEl.className = 'message assistant';
    assistantEl.innerHTML = `
      <div class="message-avatar">Æ</div>
      <div class="message-content">
        <div class="message-role">Aether</div>
        <div class="message-text streaming"></div>
      </div>
    `;
    el.messages.appendChild(assistantEl);
    const textEl = assistantEl.querySelector('.message-text');

    let accumulated = '';

    // Set up stream listeners
    const chunkHandler = (chunk) => {
      if (chunk && chunk.type === 'text' && chunk.content) {
        accumulated += chunk.content;
        textEl.innerHTML = formatMessage(accumulated) + '<span class="streaming-cursor"></span>';
        scrollToBottom();
      }
    };
    const endHandler = () => {
      if (api && api.off) {
        api.off('event:stream-chunk', chunkHandler);
        api.off('event:stream-end', endHandler);
      }
      textEl.innerHTML = formatMessage(accumulated);
      // Wire up code block copy buttons
      textEl.querySelectorAll('.cb-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          navigator.clipboard.writeText(btn.dataset.code).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
          });
        });
      });
      // Add actions
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      actions.innerHTML = `
        <button class="message-action" data-action="copy-all">Copy All</button>
        <button class="message-action" data-action="regenerate">Regenerate</button>
      `;
      assistantEl.querySelector('.message-content').appendChild(actions);
      actions.querySelector('[data-action="copy-all"]').addEventListener('click', () => {
        navigator.clipboard.writeText(accumulated);
        showToast('Copied', 'Message copied to clipboard', 'success', 2000);
      });
      actions.querySelector('[data-action="regenerate"]').addEventListener('click', regenerateLast);

      state.messages.push({ role: 'assistant', content: accumulated, timestamp: Date.now() });
      scrollToBottom();
    };

    if (api && api.onStreamChunk && api.onStreamEnd) {
      api.onStreamChunk(chunkHandler);
      api.onStreamEnd(endHandler);
    }

    // Remove typing indicator
    const typing = el.messages.querySelector('.typing-indicator');
    if (typing) typing.closest('.message').remove();

    await callApi(api.streamChat, text, state.currentSessionId);

    // Fallback: if no streaming events arrive within timeout, finalize
    setTimeout(() => {
      if (accumulated === '') {
        endHandler();
      }
    }, 30000);
  }

  function regenerateLast() {
    // Remove last assistant message
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'assistant') {
        state.messages.splice(i, 1);
        break;
      }
    }
    // Find last user message
    let lastUser = null;
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'user') {
        lastUser = state.messages[i];
        break;
      }
    }
    if (!lastUser) return;
    // Remove it from state (will be re-added by sendMessage)
    const idx = state.messages.indexOf(lastUser);
    state.messages.splice(idx, 1);
    el.messageInput.value = lastUser.content;
    renderMessages();
    sendMessage();
  }

  // ============================================================
  // Model & mode switching
  // ============================================================
  function buildModelDropdown() {
    el.modelDropdown.innerHTML = '';
    for (const [provider, models] of Object.entries(MODEL_CATALOG)) {
      const group = document.createElement('div');
      group.className = 'dropdown-group';
      group.innerHTML = `<div class="dropdown-group-title">${provider.toUpperCase()}</div>`;
      for (const model of models) {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.dataset.modelId = model.id;
        item.dataset.provider = provider;
        item.innerHTML = `
          <span class="model-provider-dot" style="background:${PROVIDER_COLORS[provider]}"></span>
          <div class="dropdown-item-info">
            <span class="dropdown-item-name">${escapeHtml(model.name)}</span>
            <span class="dropdown-item-features">${escapeHtml(model.features)}</span>
          </div>
        `;
        item.addEventListener('click', () => selectModel(provider, model));
        group.appendChild(item);
      }
      el.modelDropdown.appendChild(group);
    }
  }

  function toggleModelDropdown() {
    el.modelDropdown.classList.toggle('hidden');
  }

  function selectModel(provider, model) {
    state.currentModel = { ...model, provider };
    updateModelDisplay();
    el.modelDropdown.classList.add('hidden');
    if (api && api.switchModel) {
      callApi(api.switchModel, model.id).catch(() => {});
    }
  }

  function updateModelDisplay() {
    if (!state.currentModel) return;
    el.currentModel.textContent = state.currentModel.name;
    el.providerDot.style.background = PROVIDER_COLORS[state.currentModel.provider] || '#888';
    // Update selected state in dropdown
    el.modelDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.modelId === state.currentModel.id);
    });
  }

  function cycleModel() {
    // Flatten all models
    const all = [];
    for (const [provider, models] of Object.entries(MODEL_CATALOG)) {
      for (const m of models) all.push({ ...m, provider });
    }
    if (all.length === 0) return;
    const currentIdx = state.currentModel
      ? all.findIndex(m => m.id === state.currentModel.id)
      : -1;
    const nextIdx = (currentIdx + 1) % all.length;
    selectModel(all[nextIdx].provider, all[nextIdx]);
    // Visual feedback
    el.modelBtn.style.transform = 'scale(1.05)';
    setTimeout(() => { el.modelBtn.style.transform = ''; }, 200);
  }

  function switchMode(mode) {
    state.currentMode = mode;
    el.modeSwitch.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  // ============================================================
  // Settings
  // ============================================================
  async function loadSettings() {
    try {
      const result = await callApi(api.getSettings);
      if (result && result.settings) {
        Object.assign(state.settings, result.settings);
      }
    } catch (err) {
      // Use defaults
    }
    // Apply to UI
    el.themeSelect.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === state.settings.theme);
    });
    el.languageSelect.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === state.settings.language);
    });
    el.tempSlider.value = state.settings.temperature;
    el.tempValue.textContent = state.settings.temperature.toFixed(1);
    el.streamToggle.checked = state.settings.streamResponse;
    applyTheme(state.settings.theme);
  }

  async function saveSettings() {
    try {
      await callApi(api.updateSettings, state.settings);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }

  // ============================================================
  // Export
  // ============================================================
  function exportConversation() {
    if (state.messages.length === 0) {
      alert('No messages to export');
      return;
    }

    let content = '';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    if (state.exportFormat === 'markdown') {
      content = `# Aether Conversation\n\nExported: ${new Date().toLocaleString()}\nModel: ${state.currentModel ? state.currentModel.name : 'Unknown'}\n\n---\n\n`;
      for (const msg of state.messages) {
        const role = msg.role === 'user' ? '🧑 You' : '🤖 Aether';
        content += `## ${role}\n\n${msg.content}\n\n---\n\n`;
      }
      downloadFile(content, `aether-conversation-${timestamp}.md`, 'text/markdown');
    } else if (state.exportFormat === 'json') {
      content = JSON.stringify({
        exportedAt: new Date().toISOString(),
        model: state.currentModel,
        messages: state.messages,
      }, null, 2);
      downloadFile(content, `aether-conversation-${timestamp}.json`, 'application/json');
    } else {
      // Plain text
      for (const msg of state.messages) {
        const role = msg.role === 'user' ? 'You' : 'Aether';
        content += `[${role}]\n${msg.content}\n\n`;
      }
      downloadFile(content, `aether-conversation-${timestamp}.txt`, 'text/plain');
    }

    el.exportModal.classList.add('hidden');
    showToast('Exported', `Conversation saved as ${filename}`, 'success', 3000);
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // UI helpers
  // ============================================================
  function toggleSidebar() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    el.sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
  }

  function autoResizeTextarea() {
    const ta = el.messageInput;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  function updateCharCount() {
    el.charCount.textContent = el.messageInput.value.length;
    el.sendBtn.disabled = el.messageInput.value.trim().length === 0 || state.isStreaming;
  }

  // ============================================================
  // Boot
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
