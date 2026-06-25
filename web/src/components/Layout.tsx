import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import ProviderBar from './ProviderBar';
import { useAppStore } from '../stores/app';

export default function Layout({ children }: { children: ReactNode }) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  return (
    <div className="h-screen flex flex-col bg-base text-ink">
      {/* Skip-to-content link — first focusable element */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-void focus:rounded-sm focus:font-ui focus:text-sm"
      >
        跳到主内容
      </a>

      {/* Provider Bar — always visible */}
      <ProviderBar />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-56' : 'w-0'
          } transition-all duration-200 overflow-hidden border-r border-border-subtle shrink-0`}
        >
          <Sidebar />
        </aside>

        {/* Content */}
        <main id="main-content" className="flex-1 min-w-0 overflow-hidden bg-grid relative">
          <div className="ambient-glow" />
          <div className="relative z-10 h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
