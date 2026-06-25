import { useAppStore } from '../stores/app';
import { switchModel } from '../api/client';

const PROVIDERS = [
  { id: 'claude', name: 'Claude', model: 'Sonnet', color: 'bg-provider-claude', dot: '#f59e0b' },
  { id: 'openai', name: 'GPT-4', model: 'Turbo', color: 'bg-provider-gpt', dot: '#10b981' },
  { id: 'gemini', name: 'Gemini', model: 'Pro', color: 'bg-provider-gemini', dot: '#4285f4' },
  { id: 'minimax', name: 'MiniMax', model: 'abab6.5', color: 'bg-provider-minimax', dot: '#ec4899' },
  { id: 'moonshot', name: 'Moonshot', model: 'v1', color: 'bg-provider-moonshot', dot: '#94a3b8' },
  { id: 'glm', name: 'GLM', model: 'GLM-4', color: 'bg-provider-glm', dot: '#06b6d4' },
  { id: 'deepseek', name: 'DeepSeek', model: 'V3', color: 'bg-provider-deepseek', dot: '#6366f1' },
];

export default function ProviderBar() {
  const currentModel = useAppStore((s) => s.currentModel);
  const setModel = useAppStore((s) => s.setModel);

  const isActive = (id: string) => currentModel.startsWith(id);

  return (
    <div className="w-full border-b border-border-subtle bg-base/80 backdrop-blur-sm">
      <div className="flex items-center px-4 h-12 gap-1">
        {PROVIDERS.map((p) => {
          const active = isActive(p.id);
          return (
            <button
              key={p.id}
              onClick={() => {
                setModel(p.id);
                switchModel(p.id).catch(() => {});
              }}
              className={`
                group flex items-center gap-2 px-3 py-1.5 rounded-sm transition-all duration-300
                ${active
                  ? 'bg-white/[0.04] border border-white/[0.08]'
                  : 'border border-transparent hover:bg-white/[0.02]'
                }
              `}
              title={`${p.name} · ${p.model}`}
            >
              {/* Dot + glow */}
              <span
                className="w-[7px] h-[7px] rounded-full transition-shadow duration-300"
                style={{
                  backgroundColor: p.dot,
                  boxShadow: active ? `0 0 6px ${p.dot}80` : 'none',
                  opacity: active ? 1 : 0.4,
                }}
              />

              {/* Name */}
              <span
                className={`font-display text-[13px] font-medium transition-colors duration-300 ${
                  active ? 'text-ink' : 'text-ink-muted'
                }`}
              >
                {p.name}
              </span>

              {/* Model badge */}
              <span
                className={`text-[10px] font-ui transition-all duration-300 ${
                  active ? 'text-ink-secondary opacity-100' : 'opacity-0 group-hover:opacity-60 text-ink-muted'
                }`}
              >
                {p.model}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
