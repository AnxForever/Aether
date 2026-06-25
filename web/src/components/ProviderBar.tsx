import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/app';
import { useI18n } from '../stores/i18n';
import { switchModel } from '../api/client';
import { createLogger } from '../../../src/utils/logger';
import { MoreHorizontal } from 'lucide-react';

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
  t: { [key: string]: unknown };
}

const ProviderButton = memo(
  function ProviderButton({ id, name, model, dot, active, onSelect, t }: ProviderButtonProps) {
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
        role="radio"
        aria-checked={active}
        aria-label={`${name} ${model}`}
        title={`${name} · ${model}`}
      >
        {/* Dot + glow */}
        <span
          className={`rounded-full transition-all duration-300 ${
            active ? 'w-[9px] h-[9px] animate-pulse-glow' : 'w-[7px] h-[7px]'
          }`}
          style={{
            backgroundColor: dot,
            boxShadow: active ? `0 0 8px ${dot}99` : 'none',
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
  (prev, next) => prev.id === next.id && prev.active === next.active && prev.t === next.t,
);

export default function ProviderBar() {
  const t = useI18n((s) => s.t);
  const currentModel = useAppStore((s) => s.currentModel);
  const setModel = useAppStore((s) => s.setModel);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close overflow on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    if (overflowOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [overflowOpen]);

  const handleSelect = (id: string) => {
    setModel(id);
    switchModel(id).catch((err) => { logger.error('切换模型失败:', err); });
    setOverflowOpen(false);
  };

  // Visible providers per breakpoint: 2 on <480, 4 on <768, all on >=768
  const overflowProviders = PROVIDERS.slice(4);
  const providerRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleProviderKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (index + 1) % PROVIDERS.length;
      const el = providerRefs.current[next]?.querySelector('button');
      el?.focus();
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (index - 1 + PROVIDERS.length) % PROVIDERS.length;
      const el = providerRefs.current[prev]?.querySelector('button');
      el?.focus();
    }
  }, []);

  return (
    <div className="w-full border-b border-border-subtle bg-base/80 backdrop-blur-sm">
      <div className="flex items-center px-4 h-12 gap-1 overflow-x-auto scrollbar-none" role="radiogroup" aria-label={t.settings.title}>
        {PROVIDERS.map((p, i) => (
          <div
            key={p.id}
            ref={(el) => { providerRefs.current[i] = el; }}
            onKeyDown={(e) => handleProviderKeyDown(e, i)}
            className={
              i >= 4 ? 'hidden sm:flex' :
              i >= 2 ? 'hidden max-sm:flex sm:flex' :
              'flex'
            }
          >
            <ProviderButton
              id={p.id}
              name={p.name}
              model={p.model}
              dot={p.dot}
              active={currentModel.startsWith(p.id)}
              onSelect={handleSelect}
              t={t}
            />
          </div>
        ))}

        {/* Overflow menu — visible on small screens */}
        <div className="relative sm:hidden" ref={overflowRef}>
          <button
            onClick={() => setOverflowOpen(!overflowOpen)}
            className="flex items-center px-2 py-1.5 rounded-sm text-ink-muted hover:text-ink hover:bg-white/[0.04] transition-colors"
            aria-label={t.settings.title}
          >
            <MoreHorizontal size={16} />
          </button>

          {overflowOpen && (
            <div className="absolute top-full left-0 mt-1 w-44 glass-elevated rounded-sm shadow-xl animate-fade-in z-50">
              {overflowProviders.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p.id)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm font-ui transition-colors ${
                    currentModel.startsWith(p.id)
                      ? 'text-ink bg-white/[0.04]'
                      : 'text-ink-secondary hover:text-ink hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: p.dot }} />
                  <span>{p.name}</span>
                  <span className="ml-auto text-[10px] text-ink-muted">{p.model}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
