import { NavLink } from 'react-router-dom';
import { MessageSquare, Zap, Workflow, Settings, LogOut, Plus, PanelLeftClose } from 'lucide-react';
import { useAppStore } from '../stores/app';
import { newSession } from '../api/client';

const navItems = [
  { to: '/chat', icon: MessageSquare, label: '对话' },
  { to: '/skills', icon: Zap, label: '技能' },
  { to: '/workflows', icon: Workflow, label: '工作流' },
  { to: '/settings', icon: Settings, label: '设置' },
];

export default function Sidebar() {
  const logout = useAppStore((s) => s.logout);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <div className="flex flex-col h-full py-3">
      {/* User identity */}
      <div className="flex items-center gap-2.5 px-4 mb-4">
        <div className="w-8 h-8 rounded-sm bg-accent/10 flex items-center justify-center border border-accent/20">
          <span className="text-xs font-bold text-accent font-display">A</span>
        </div>
        <div className="flex flex-col">
          <span className="font-ui text-caption font-medium text-ink">Admin</span>
          <span className="flex items-center gap-1 text-[10px] text-ink-muted font-ui">
            <span className="w-[5px] h-[5px] rounded-full bg-success animate-pulse-glow inline-block" />
            online
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-sm bg-accent flex items-center justify-center">
            <span className="text-[10px] font-bold text-void font-display">A</span>
          </div>
          <span className="font-display font-semibold text-[15px] tracking-tight">Aether</span>
        </div>
        <button onClick={toggleSidebar} aria-label="切换侧边栏" className="p-1 rounded-sm hover:bg-white/[0.04] text-ink-muted hover:text-ink transition-colors">
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* New Chat */}
      <div className="px-3 mb-3">
        <button
          onClick={() => { clearMessages(); newSession().catch(() => {}); }}
          aria-label="新建对话"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-sm border border-border-default text-ink-secondary hover:text-ink hover:bg-white/[0.04] transition-all text-caption font-ui"
        >
          <Plus size={14} />
          <span>新对话</span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-sm transition-colors font-ui text-caption ${
                isActive
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-ink-secondary hover:text-ink hover:bg-white/[0.03] border border-transparent'
              }`
            }
          >
            <Icon size={15} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pt-2 border-t border-border-subtle">
        <button
          onClick={logout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-sm text-ink-muted hover:text-danger hover:bg-danger/5 transition-colors font-ui text-caption"
        >
          <LogOut size={14} />
          <span>退出</span>
        </button>
      </div>
    </div>
  );
}
