import { Menu, Plus } from 'lucide-react';
import { useAppStore } from '../stores/app';

export default function TopBar() {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const currentModel = useAppStore((s) => s.currentModel);
  const newSession = useAppStore((s) => s.clearMessages);

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-aether-700/30 shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className="btn-ghost p-2">
          <Menu size={18} />
        </button>
        <button onClick={newSession} className="btn-ghost flex items-center gap-1.5 text-sm">
          <Plus size={16} />
          新对话
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-aether-400 bg-aether-800 px-2 py-1 rounded">
          {currentModel}
        </span>
      </div>
    </header>
  );
}
