import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, StopCircle, Sparkles } from 'lucide-react';
import { sendMessage, streamChat } from '../api/client';
import { useAppStore } from '../stores/app';

export default function ChatPage() {
  const { messages, addMessage, isStreaming, setStreaming, sessionId, setSessionId } =
    useAppStore();
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);
    setInput('');
    setStreamingContent('');
    setStreaming(true);

    const controller = streamChat(
      text,
      sessionId ?? undefined,
      (chunk) => setStreamingContent((prev) => prev + chunk),
      (newSessionId) => {
        setSessionId(newSessionId);
        setStreaming(false);
        const content = streamingContent;
        if (content) {
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content,
            timestamp: Date.now(),
          });
        }
        setStreamingContent('');
      },
      (error) => {
        console.error('Stream error:', error);
        setStreaming(false);
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `错误: ${error}`,
          timestamp: Date.now(),
        });
      }
    );
    abortRef.current = controller;
  }, [input, isStreaming, sessionId, streamingContent]);

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
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
              <Sparkles size={32} className="text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">开始对话</h2>
            <p className="text-aether-400 text-sm max-w-md">
              Aether 集成 7 个 AI 提供商。选择一个模型，开始你的创作。
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-aether-800/70 text-aether-100'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Streaming bubble */}
        {streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-aether-800/70 text-aether-100">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{streamingContent}</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-aether-700/30">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            rows={1}
            className="input flex-1 resize-none min-h-[44px] max-h-[200px] py-3"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button onClick={handleStop} className="p-3 rounded-xl bg-red-600 hover:bg-red-500 transition-colors">
              <StopCircle size={20} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              <Send size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
