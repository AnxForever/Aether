import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAppStore } from '../stores/app';

export default function Layout({ children }: { children: ReactNode }) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  return (
    <div className="h-screen flex bg-aether-950 text-white">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-200 overflow-hidden border-r border-aether-700/30 bg-aether-900/50`}
      >
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
