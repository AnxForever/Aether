import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, StopCircle, Hash } from 'lucide-react';
import { streamChat, newSession } from '../api/client';
import { useAppStore } from '../stores/app';
import ChatMessage from '../components/ChatMessage';
import EmptyState from '../components/EmptyState';
import SuggestedPrompts from '../components/SuggestedPrompts';
import { createLogger } from '../../../src/utils/logger';

const logger = createLogger('ChatPage');

const DATE_FORMAT = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' });

/** Convert timestamp to date key for grouping */
function dateKey(ts: number): string {
  return new Date(ts).toDateString();
}

function DateSeparator({ ts }: { ts: number }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-border-subtle" />
      <span className="font-ui text-[10px] text-ink-ghost uppercase tracking-widest shrink-0">
        {DATE_FORMAT.format(new Date(ts))}
      </span>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  );
}

export default function ChatPage() {
  const messages = useAppStore((s) => s.messages);
  const addMessage = useAppStore((s) => s.addMessage);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const setStreaming = useAppStore((s) => s.setStreaming);
  const sessionId = useAppStore((s) => s.sessionId);
  const setSessionId = useAppStore((s) => s.setSessionId);
  const currentModel = useAppStore((s) => s.currentModel);
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [transientError, setTransientError] = useState<string | null>(null);
  const [sentPulse, setSentPulse] = useState(false);
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

    // Sent pulse animation
    setSentPulse(true);
    setTimeout(() => setSentPulse(false), 300);

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

  const handlePromptSelect = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  // Build message list with date separators
  const renderMessages = () => {
    const elements: React.ReactNode[] = [];
    let lastDateKey: string | null = null;

    for (const msg of messages) {
      const dk = dateKey(msg.timestamp);
      if (lastDateKey !== null && dk !== lastDateKey) {
        elements.push(<DateSeparator key={`sep-${msg.id}`} ts={msg.timestamp} />);
      }
      lastDateKey = dk;
      elements.push(<ChatMessage key={msg.id} msg={msg} />);
    }

    return elements;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Empty state */}
        {messages.length === 0 && !streamingContent ? (
          <div className="flex flex-col items-center pt-24">
            <EmptyState
              icon={Hash}
              title="开始对话"
              description="选择一个 AI 模型，输入消息开始编排。支持 7 个 AI 提供商。"
            />
            <SuggestedPrompts onSelect={handlePromptSelect} />
          </div>
        ) : null}

        {/* Messages with date separators */}
        {messages.length > 0 ? renderMessages() : null}

        {/* Streaming bubble */}
        {streamingContent ? (
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
        ) : null}

        <div ref={bottomRef} />
          {transientError ? (
            <div className="px-4 py-2 text-center">
              <p className="font-body text-caption text-danger bg-danger/5 px-3 py-1.5 rounded-sm border border-danger/15 inline-block">
                请求失败: {transientError}
              </p>
            </div>
          ) : null}
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-4 py-3 border-t border-border-subtle">
        <div className="flex items-end gap-2 max-w-[900px] mx-auto">
          {/* Model indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 border border-border-default rounded-sm shrink-0">
            <span
              className={`w-[5px] h-[5px] rounded-full bg-accent ${isStreaming ? 'animate-pulse-glow' : ''}`}
            />
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
            className="field flex-1 resize-none min-h-[44px] max-h-[160px] focus:shadow-[0_0_0_3px_rgba(6,182,212,0.1),0_0_12px_rgba(6,182,212,0.08)]"
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
              className={`btn btn-primary p-2.5 transition-transform duration-75 active:scale-95 ${sentPulse ? 'scale-105' : ''}`}
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
