'use client';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MSWProvider } from './MSWProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <MSWProvider>
      <QueryClientProvider client={queryClient}>
        <div className="v9-root v9-shell" data-testid="app-shell">
          <Sidebar />
          <Header />
          <main className="v9-main" id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </QueryClientProvider>
    </MSWProvider>
  );
}
