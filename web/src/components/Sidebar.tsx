import { NavLink } from 'react-router-dom';
import { MessageSquare, Zap, Workflow, Settings, LogOut } from 'lucide-react';
import { useAppStore } from '../stores/app';

const navItems = [
  { to: '/chat', icon: MessageSquare, label: '对话' },
  { to: '/skills', icon: Zap, label: '技能' },
  { to: '/workflows', icon: Workflow, label: '工作流' },
  { to: '/settings', icon: Settings, label: '设置' },
];

export default function Sidebar() {
  const logout = useAppStore((s) => s.logout);

  return (
    <div className="flex flex-col h-full p-3">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-4 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-sm">
          A
        </div>
        <span className="font-semibold text-lg">Aether</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-aether-300 hover:bg-aether-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            <span className="text-sm font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <button
        onClick={logout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-aether-400 hover:bg-red-900/20 hover:text-red-400 transition-colors text-sm"
      >
        <LogOut size={18} />
        <span>退出</span>
      </button>
    </div>
  );
}
