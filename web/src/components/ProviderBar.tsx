import { memo } from 'react';
import { useAppStore } from '../stores/app';
import { switchModel } from '../api/client';
import { createLogger } from '../../../src/utils/logger';

const logger = createLogger('ProviderBar');

const PROVIDERS = [
  { id: 'claude', name: 'Claude', model: 'Sonnet', color: 'bg-provider-claude', dot: '#f59e0b' },
  { id: 'openai', name: 'GPT-4', model: 'Turbo', color: 'bg-provider-gpt', dot: '#10b981' },
  { id: 'gemini', name: 'Gemini', model: 'Pro', color: 'bg-provider-gemini', dot: '#4285f4' },
  { id: 'minimax', name: 'MiniMax', model: 'abab6.5', color: 'bg-provider-minimax', dot: '#ec4899' },
  { id: 'moonshot', name: 'Moonshot', model: 'v1', color: 'bg-provider-moonshot', dot: '#94a3b8' },
  { id: 'glm', name: 'GLM', model: 'GLM-4', color: 'bg-provider-glm', dot: '#06b6d4' },
  { id: 'deepseek', name: 'DeepSeek', model: 'V3', color: 'bg-provider-deepseek', dot: '#6366f1' },
];

interface ProviderButtonProps {
  id: string;
  name: string;
  model: string;
  dot: string;
  active: boolean;
  onSelect: (id: string) => void;
}

const ProviderButton = memo(
  function ProviderButton({ id, name, model, dot, active, onSelect }: ProviderButtonProps) {
    return (
      <button
        onClick={() => onSelect(id)}
        className={`
          group flex items-center gap-2 px-3 py-1.5 rounded-sm transition-all duration-300
          ${active
            ? 'bg-white/[0.04] border border-white/[0.08]'
            : 'border border-transparent hover:bg-white/[0.02]'
          }
        `}
        aria-label={`切换到 ${name} ${model}`}
        title={`${name} · ${model}`}
      >
        {/* Dot + glow */}
        <span
          className="w-[7px] h-[7px] rounded-full transition-shadow duration-300"
          style={{
            backgroundColor: dot,
            boxShadow: active ? `0 0 6px ${dot}80` : 'none',
            opacity: active ? 1 : 0.4,
          }}
        />

        {/* Name */}
        <span
          className={`font-display text-[13px] font-medium transition-colors duration-300 ${
            active ? 'text-ink' : 'text-ink-muted'
          }`}
        >
          {name}
        </span>

        {/* Model badge */}
        <span
          className={`text-[10px] font-ui transition-all duration-300 ${
            active ? 'text-ink-secondary opacity-100' : 'opacity-0 group-hover:opacity-60 text-ink-muted'
          }`}
        >
          {model}
        </span>
      </button>
    );
  },
  (prev, next) => prev.id === next.id && prev.active === next.active,
);

export default function ProviderBar() {
  const currentModel = useAppStore((s) => s.currentModel);
  const setModel = useAppStore((s) => s.setModel);

  const handleSelect = (id: string) => {
    setModel(id);
    switchModel(id).catch((err) => { logger.error('切换模型失败:', err); });
  };

  return (
    <div className="w-full border-b border-border-subtle bg-base/80 backdrop-blur-sm">
      <div className="flex items-center px-4 h-12 gap-1">
        {PROVIDERS.map((p) => (
          <ProviderButton
            key={p.id}
            id={p.id}
            name={p.name}
            model={p.model}
            dot={p.dot}
            active={currentModel.startsWith(p.id)}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
