import { useAppStore } from '../stores/app';

interface MessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;
}

const TIME = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function ChatMessage({ msg }: { msg: MessageData }) {
  const currentModel = useAppStore((s) => s.currentModel);
  const isUser = msg.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div className={`max-w-[72%] min-w-[20%] ${isUser ? 'order-1' : ''}`}>
        {/* Meta bar */}
        <div className={`flex items-center gap-2 mb-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
          {!isUser && (
            <>
              <span
                className="w-[6px] h-[6px] rounded-full"
                style={{ backgroundColor: getProviderColor(msg.model || currentModel) }}
              />
              <span className="font-ui text-[11px] text-ink-muted uppercase tracking-wide">
                {msg.model || 'AI'}
              </span>
            </>
          )}
          <span className="font-body text-[10px] text-ink-ghost tabular-nums">
            {TIME.format(new Date(msg.timestamp))}
          </span>
        </div>

        {/* Content */}
        <div
          className={`
            px-4 py-3 font-body text-mono leading-relaxed
            ${isUser
              ? 'bg-accent/8 border border-accent/15 rounded-sm text-ink'
              : 'bg-elevated border border-border-subtle rounded-sm text-ink'
            }
          `}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    </div>
  );
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: '#f59e0b',
  openai: '#10b981',
  gemini: '#4285f4',
  minimax: '#ec4899',
  moonshot: '#94a3b8',
  glm: '#06b6d4',
  deepseek: '#6366f1',
};

function getProviderColor(provider: string): string {
  const lower = provider.toLowerCase();
  for (const prefix of Object.keys(PROVIDER_COLORS)) {
    if (lower.startsWith(prefix)) return PROVIDER_COLORS[prefix];
  }
  return '#06b6d4';
}
