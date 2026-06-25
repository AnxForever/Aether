import { useState, useEffect } from 'react';
import { getModels, switchModel as switchModelApi } from '../api/client';
import { useAppStore } from '../stores/app';
import { Settings, Cpu, HardDrive, Check } from 'lucide-react';

interface ModelItem {
  id: string;
  name: string;
  provider?: string;
}

export default function SettingsPage() {
  const { currentModel, setModel } = useAppStore();
  const [models, setModels] = useState<ModelItem[]>([]);

  useEffect(() => {
    getModels().then((res) => {
      if (res.success && res.data) {
        setModels((res.data.models as ModelItem[]) || []);
      }
    });
  }, []);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Settings size={16} className="text-accent" />
          </div>
          <div>
            <h1 className="font-display text-h1 text-ink">设置</h1>
            <p className="font-body text-caption text-ink-muted">系统配置与偏好</p>
          </div>
        </div>

        {/* AI 模型 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={14} className="text-ink-muted" />
            <h2 className="font-ui text-caption text-ink-muted uppercase tracking-wide">AI 模型</h2>
          </div>
          <div className="card p-1.5">
            <div className="space-y-0.5">
              {models.map((m) => {
                const selected = currentModel === (m.id || m.name);
                return (
                  <button
                    key={m.id || m.name}
                    onClick={() => { setModel(m.id || m.name); switchModelApi(m.id || m.name).catch(() => {}); }}
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
                      {m.provider && (
                        <p className="font-body text-[11px] text-ink-muted mt-0.5">{m.provider}</p>
                      )}
                    </div>
                    {selected && <Check size={14} className="text-accent shrink-0" />}
                  </button>
                );
              })}
              {models.length === 0 && (
                <p className="font-body text-caption text-ink-muted px-3 py-4 text-center">
                  暂无模型数据
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 系统信息 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={14} className="text-ink-muted" />
            <h2 className="font-ui text-caption text-ink-muted uppercase tracking-wide">系统信息</h2>
          </div>
          <div className="card space-y-2">
            <div className="flex items-center justify-between py-1">
              <span className="font-body text-caption text-ink-muted">版本</span>
              <span className="font-body text-mono text-ink">v3.0.0 Web</span>
            </div>
            <div className="border-t border-border-subtle" />
            <div className="flex items-center justify-between py-1">
              <span className="font-body text-caption text-ink-muted">前端</span>
              <span className="font-body text-mono text-ink">Vite + React + Tailwind</span>
            </div>
            <div className="border-t border-border-subtle" />
            <div className="flex items-center justify-between py-1">
              <span className="font-body text-caption text-ink-muted">后端</span>
              <span className="font-body text-mono text-ink">Express + NexusAgent</span>
            </div>
            <div className="border-t border-border-subtle" />
            <div className="flex items-center justify-between py-1">
              <span className="font-body text-caption text-ink-muted">运行时</span>
              <span className="font-body text-mono text-ink">Electron 30 + Node 22</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
