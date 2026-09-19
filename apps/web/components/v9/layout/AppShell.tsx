'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { AiDrawer } from '../ai/AiDrawer';
import { MSWProvider } from './MSWProvider';
import { useSessionStore } from '@/stores/useSessionStore';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 2 } },
});

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useSessionStore();
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);

  // Global keyboard shortcuts
  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      // ⌘K or Ctrl+K — CommandPalette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
        setAiOpen(false);
      }
      // ⌘I or Ctrl+I — AI Drawer
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setAiOpen(o => !o);
        setCmdOpen(false);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="v9-root v9-shell" data-testid="app-shell">
      {/* Mobile overlay when sidebar open */}
      {sidebarOpen && (
        <div
          className="lg:hidden"
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.4)', zIndex: 49 }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar aiOpen={aiOpen} onToggleAi={() => { setAiOpen(o => !o); setCmdOpen(false); }} />
      <Header onOpenCmd={() => setCmdOpen(true)} onToggleAi={() => setAiOpen(o => !o)} aiOpen={aiOpen} />

      <main className="v9-main" id="main-content" tabIndex={-1}>
        {children}
      </main>

      {/* Global overlays */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <AiDrawer open={aiOpen} onClose={() => setAiOpen(false)} pathname={pathname} />

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            borderRadius: 8,
          },
        }}
      />
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <MSWProvider>
      <QueryClientProvider client={queryClient}>
        <AppShellInner>{children}</AppShellInner>
      </QueryClientProvider>
    </MSWProvider>
  );
}
