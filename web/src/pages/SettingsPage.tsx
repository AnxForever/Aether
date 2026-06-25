import { useState, useEffect } from 'react';
import { getModels } from '../api/client';
import { useAppStore } from '../stores/app';
import { Settings, Cpu, HardDrive } from 'lucide-react';

export default function SettingsPage() {
  const { currentModel, setModel } = useAppStore();
  const [models, setModels] = useState<any[]>([]);

  useEffect(() => {
    getModels().then((res) => {
      if (res.success && res.data) setModels(res.data.models || []);
    });
  }, []);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Settings size={24} className="text-aether-300" />
          <h1 className="text-xl font-bold">设置</h1>
        </div>

        {/* Model Selection */}
        <section className="card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu size={18} className="text-blue-400" />
            <h2 className="font-semibold">AI 模型</h2>
          </div>
          <div className="space-y-2">
            {models.map((m: any) => (
              <button
                key={m.id || m.name}
                onClick={() => setModel(m.id || m.name)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  currentModel === (m.id || m.name)
                    ? 'bg-blue-600/20 border border-blue-500/50'
                    : 'bg-aether-800/30 border border-transparent hover:bg-aether-800/50'
                }`}
              >
                <p className="font-medium text-sm">{m.name || m.id}</p>
                {m.provider && (
                  <p className="text-xs text-aether-400 mt-0.5">{m.provider}</p>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* System Info */}
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive size={18} className="text-green-400" />
            <h2 className="font-semibold">系统</h2>
          </div>
          <div className="text-sm text-aether-400 space-y-1">
            <p>Aether v3.0.0 Web Edition</p>
            <p>前端: Vite + React + Tailwind CSS</p>
            <p>后端: Express + NexusAgent (30 子系统)</p>
          </div>
        </section>
      </div>
    </div>
  );
}
