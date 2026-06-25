import { useState, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, Zap, Workflow, Settings, LogOut, Plus, PanelLeftClose } from 'lucide-react';
import { useAppStore } from '../stores/app';
import { useI18n } from '../stores/i18n';
import { newSession } from '../api/client';

const navItems = [
  { to: '/chat', icon: MessageSquare, labelKey: 'chat' as const },
  { to: '/skills', icon: Zap, labelKey: 'skills' as const },
  { to: '/workflows', icon: Workflow, labelKey: 'workflows' as const },
  { to: '/settings', icon: Settings, labelKey: 'settings' as const },
];

export default function Sidebar() {
  const t = useI18n((s) => s.t);
  const setLocale = useI18n((s) => s.setLocale);
  const locale = useI18n((s) => s.locale);
  const logout = useAppStore((s) => s.logout);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const location = useLocation();
  const [navFocusIndex, setNavFocusIndex] = useState<number | null>(null);

  const handleNavKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (index + 1) % navItems.length;
      setNavFocusIndex(next);
      document.querySelector<HTMLAnchorElement>(`[data-nav-index="${next}"]`)?.focus();
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (index - 1 + navItems.length) % navItems.length;
      setNavFocusIndex(prev);
      document.querySelector<HTMLAnchorElement>(`[data-nav-index="${prev}"]`)?.focus();
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      document.querySelector<HTMLAnchorElement>(`[data-nav-index="${index}"]`)?.click();
    }
  }, []);

  return (
    <div className="flex flex-col h-full py-3">
      {/* User identity */}
      <div className="flex items-center gap-2.5 px-4 mb-4">
        <div className="w-8 h-8 rounded-sm bg-accent/10 flex items-center justify-center border border-accent/20">
          <span className="text-xs font-bold text-accent font-display">A</span>
        </div>
        <div className="flex flex-col">
          <span className="font-ui text-sm font-medium text-ink">Admin</span>
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
        <button onClick={toggleSidebar} aria-label={t.common.appName} className="p-1 rounded-sm hover:bg-white/[0.04] text-ink-muted hover:text-ink transition-colors">
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* New Chat */}
      <div className="px-3 mb-3">
        <button
          onClick={() => { clearMessages(); newSession().catch(() => {}); }}
          aria-label={t.common.newChat}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-sm border border-border-default text-ink-secondary hover:text-ink hover:bg-white/[0.04] transition-all text-sm font-ui"
        >
          <Plus size={14} />
          <span>{t.common.newChat}</span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5" role="navigation" aria-label={t.nav.chat}>
        {navItems.map(({ to, icon: Icon, labelKey }, index) => {
          const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
          return (
            <NavLink
              key={to}
              to={to}
              data-nav-index={index}
              aria-current={isActive ? 'page' : undefined}
              tabIndex={navFocusIndex === null ? 0 : navFocusIndex === index ? 0 : -1}
              onKeyDown={(e) => handleNavKeyDown(e, index)}
              className={({ isActive: active }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-sm transition-colors font-ui text-sm ${
                  active
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'text-ink-secondary hover:text-ink hover:bg-white/[0.03] border border-transparent'
                }`
              }
            >
              <Icon size={15} />
              <span>{t.nav[labelKey]}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pt-2 border-t border-border-subtle">
        {/* Language switcher */}
        <div className="px-3 mb-2">
          <button
            onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            className="text-[10px] px-2 py-1 border border-border-default rounded-sm text-ink-muted hover:text-ink hover:bg-white/[0.04] transition-colors font-ui"
            aria-label={locale === 'zh' ? 'Switch to English' : '切换到中文'}
          >
            {locale === 'zh' ? 'EN' : '中'}
          </button>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-sm text-ink-muted hover:text-danger hover:bg-danger/5 transition-colors font-ui text-sm"
        >
          <LogOut size={14} />
          <span>{t.common.logout}</span>
        </button>
      </div>
    </div>
  );
}
