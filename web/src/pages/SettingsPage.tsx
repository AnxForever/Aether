import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getModels, switchModel as switchModelApi } from '../api/client';
import { useAppStore } from '../stores/app';
import { Settings, Cpu, HardDrive, Check, Circle } from 'lucide-react';
import { createLogger } from '../../../src/utils/logger';
import Skeleton from '../components/Skeleton';

const logger = createLogger('SettingsPage');

interface ModelItem {
  id: string;
  name: string;
  provider?: string;
}

/** Known provider names — all others grouped as "Other" */
const KNOWN_PROVIDERS = ['Claude', 'OpenAI', 'Gemini', 'MiniMax', 'Moonshot', 'GLM', 'DeepSeek'];

/** Normalise provider string to a display key */
function normalizeProvider(p?: string): string {
  if (!p) return 'Other';
  for (const known of KNOWN_PROVIDERS) {
    if (p.toLowerCase().includes(known.toLowerCase())) return known;
  }
  return 'Other';
}

/** Simulated connection status per provider — in production this would come from the API */
function providerConnected(provider: string): boolean {
  // For now all known providers are considered connected
  return provider !== 'Other';
}

const checkVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: [0, 1.25, 1],
    opacity: [0, 1, 1],
    transition: { duration: 0.3, ease: 'easeOut' },
  },
} as const;

export default function SettingsPage() {
  const currentModel = useAppStore((s) => s.currentModel);
  const setModel = useAppStore((s) => s.setModel);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getModels()
      .then((res) => {
        if (res.success && res.data) {
          setModels((res.data.models as ModelItem[]) || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        logger.error('获取模型列表失败:', err);
        setError('获取模型列表失败，请检查网络连接');
        setLoading(false);
      });
  }, []);

  // Group models by provider
  const groups = useMemo(() => {
    const map = new Map<string, ModelItem[]>();
    for (const m of models) {
      const key = normalizeProvider(m.provider);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    // Order by KNOWN_PROVIDERS, then Others at the end
    const ordered: { provider: string; items: ModelItem[] }[] = [];
    for (const k of KNOWN_PROVIDERS) {
      if (map.has(k)) ordered.push({ provider: k, items: map.get(k)! });
    }
    if (map.has('Other')) ordered.push({ provider: 'Other', items: map.get('Other')! });
    return ordered;
  }, [models]);

  const selectedInGroup = (items: ModelItem[]) => items.some((m) => currentModel === (m.id || m.name));

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-accent/10 border border-accent/20 flex items-center justify-center ring-1 ring-accent/10">
            <Settings size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-ink">设置</h1>
            <p className="font-body text-sm text-ink-muted">系统配置与偏好</p>
          </div>
        </div>

        {/* AI 模型 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={14} className="text-ink-muted" />
            <h2 className="font-ui text-sm text-ink-muted uppercase tracking-wide">AI 模型</h2>
          </div>
          <div className="card p-1.5">
            <div className="space-y-0.5">
              {loading ? (
                <div className="space-y-0.5 p-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-sm" />
                  ))}
                </div>
              ) : error ? (
                <p className="font-body text-sm text-danger bg-danger/5 px-3 py-4 text-center rounded-sm border border-danger/15">
                  {error}
                </p>
              ) : (
                <div className="space-y-4">
                  {groups.map((group) => {
                    const connected = providerConnected(group.provider);
                    return (
                      <div key={group.provider}>
                        {/* Provider group header with connection status */}
                        <div className="flex items-center gap-2 px-3 pt-1 pb-1">
                          <span className="font-ui text-[10px] text-ink-muted tracking-widest uppercase">{group.provider}</span>
                          <div className="flex-1 border-t border-border-subtle" />
                          <div className="flex items-center gap-1">
                            <Circle
                              size={6}
                              className={connected ? 'text-emerald-400 fill-emerald-400' : 'text-red-400 fill-red-400'}
                            />
                            <span className="font-body text-[9px] text-ink-ghost">
                              {connected ? '已连接' : '未连接'}
                            </span>
                          </div>
                        </div>

                        {/* Model items */}
                        {group.items.map((m) => {
                          const selected = currentModel === (m.id || m.name);
                          return (
                            <button
                              key={m.id || m.name}
                              onClick={() => {
                                setModel(m.id || m.name);
                                switchModelApi(m.id || m.name).catch((err) => {
                                  logger.error('切换模型失败:', err);
                                });
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-sm transition-all text-left ${
                                selected
                                  ? 'bg-accent/8 border border-accent/20'
                                  : 'border border-transparent hover:bg-white/[0.03]'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className={`font-body text-mono ${selected ? 'text-accent-light' : 'text-ink'}`}>
                                  {m.name || m.id}
                                </p>
                                {m.provider ? (
                                  <p className="font-body text-[11px] text-ink-muted mt-0.5">{m.provider}</p>
                                ) : null}
                              </div>
                              <AnimatePresence mode="wait">
                                {selected ? (
                                  <motion.div
                                    key="check"
                                    {...(checkVariants as any)}
                                    initial="initial"
                                    animate="animate"
                                    exit="initial"
                                  >
                                    <Check size={14} className="text-accent shrink-0" />
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                  {models.length === 0 ? (
                    <p className="font-body text-sm text-ink-muted px-3 py-4 text-center">
                      暂无模型数据
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 系统信息 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={14} className="text-ink-muted" />
            <h2 className="font-ui text-sm text-ink-muted uppercase tracking-wide">系统信息</h2>
          </div>
          <div className="card space-y-2">
            <div className="flex items-center justify-between py-1">
              <span className="font-body text-sm text-ink-muted">版本</span>
              <span className="font-body text-mono text-ink">v3.0.0 Web</span>
            </div>
            <div className="border-t border-border-subtle" />
            <div className="flex items-center justify-between py-1">
              <span className="font-body text-sm text-ink-muted">前端</span>
              <span className="font-body text-mono text-ink">Vite + React + Tailwind</span>
            </div>
            <div className="border-t border-border-subtle" />
            <div className="flex items-center justify-between py-1">
              <span className="font-body text-sm text-ink-muted">后端</span>
              <span className="font-body text-mono text-ink">Express + NexusAgent</span>
            </div>
            <div className="border-t border-border-subtle" />
            <div className="flex items-center justify-between py-1">
              <span className="font-body text-sm text-ink-muted">运行时</span>
              <span className="font-body text-mono text-ink">Electron 30 + Node 22</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
