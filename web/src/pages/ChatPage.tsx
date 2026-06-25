import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, StopCircle, Sparkles, Hash } from 'lucide-react';
import { streamChat, newSession } from '../api/client';
import { useAppStore } from '../stores/app';
import ChatMessage from '../components/ChatMessage';
import { createLogger } from '../../../src/utils/logger';

const logger = createLogger('ChatPage');

export default function ChatPage() {
  const { messages, addMessage, isStreaming, setStreaming, sessionId, setSessionId, currentModel } =
    useAppStore();
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [transientError, setTransientError] = useState<string | null>(null);
  const streamingRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: text,
      timestamp: Date.now(),
      model: currentModel,
    };
    addMessage(userMsg);
    setInput('');
    streamingRef.current = '';
    setStreamingContent('');
    setStreaming(true);

    const controller = streamChat(
      text,
      sessionId ?? undefined,
      currentModel,
      (chunk) => {
        streamingRef.current += chunk;
        setStreamingContent(streamingRef.current);
      },
      (newSessionId) => {
        setSessionId(newSessionId);
        setStreaming(false);
        const final = streamingRef.current;
        if (final) {
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: final,
            timestamp: Date.now(),
            model: currentModel,
          });
        }
        setStreamingContent('');
      },
      (error) => {
        logger.error('流式响应出错: ' + error);
        setStreaming(false);
        setStreamingContent('');
        setTransientError(error);
        setTimeout(() => setTransientError(null), 6000);
      }
    );
    abortRef.current = controller;
  }, [input, isStreaming, sessionId, currentModel]);

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setStreamingContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Empty state */}
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 mb-4 rounded-sm bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Hash size={24} className="text-accent" />
            </div>
            <h2 className="font-display text-h1 text-ink mb-1.5">开始对话</h2>
            <p className="font-body text-caption text-ink-muted max-w-xs leading-relaxed">
              选择一个 AI 模型，输入消息开始编排。支持 7 个 AI 提供商。
            </p>
            <div className="flex gap-1.5 mt-4">
              {['claude', 'openai', 'gemini', 'glm', 'deepseek'].map((p) => (
                <span
                  key={p}
                  className="w-[5px] h-[5px] rounded-full opacity-40"
                  style={{
                    backgroundColor: {
                      claude: '#f59e0b', openai: '#10b981', gemini: '#4285f4',
                      glm: '#06b6d4', deepseek: '#6366f1',
                    }[p],
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} msg={msg} />
        ))}

        {/* Streaming bubble */}
        {streamingContent && (
          <div className="animate-slide-up">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-[6px] h-[6px] rounded-full bg-accent animate-pulse-glow" />
              <span className="font-ui text-[11px] text-ink-muted uppercase tracking-wide">
                {currentModel}
              </span>
              <span className="font-body text-[10px] text-accent animate-pulse-glow">● streaming</span>
            </div>
            <div className="max-w-[72%] px-4 py-3 bg-elevated border border-accent/15 rounded-sm">
              <p className="font-body text-mono leading-relaxed text-ink whitespace-pre-wrap">
                {streamingContent}
                <span className="cursor-blink" />
              </p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
          {transientError && (
            <div className="px-4 py-2 text-center">
              <p className="font-body text-caption text-danger bg-danger/5 px-3 py-1.5 rounded-sm border border-danger/15 inline-block">
                请求失败: {transientError}
              </p>
            </div>
          )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-4 py-3 border-t border-border-subtle">
        <div className="flex items-end gap-2 max-w-[900px] mx-auto">
          {/* Model indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 border border-border-default rounded-sm shrink-0">
            <span className="w-[5px] h-[5px] rounded-full bg-accent" />
            <span className="font-ui text-[11px] text-ink-muted uppercase">{currentModel}</span>
          </div>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送)"
            aria-label="消息输入"
            rows={1}
            className="field flex-1 resize-none min-h-[44px] max-h-[160px]"
            disabled={isStreaming}
          />

          {isStreaming ? (
            <button
              onClick={handleStop}
              aria-label="停止生成"
              className="p-2.5 rounded-sm bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-colors"
            >
              <StopCircle size={18} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              aria-label="发送消息"
              className="btn btn-primary p-2.5"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
