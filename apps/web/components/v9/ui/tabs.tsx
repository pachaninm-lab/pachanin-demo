'use client';
import * as React from 'react';
import { cn } from '@/lib/v9/utils';

interface TabsContextValue {
  value: string;
  onChange: (v: string) => void;
}
const TabsCtx = React.createContext<TabsContextValue>({ value: '', onChange: () => {} });

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}

function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue);
  const current = value ?? internal;
  const set = onValueChange ?? setInternal;
  return (
    <TabsCtx.Provider value={{ value: current, onChange: set }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn('flex gap-0 border-b border-border', className)}
    >
      {children}
    </div>
  );
}

function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsCtx);
  const active = ctx.value === value;
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => ctx.onChange(value)}
      className={cn(
        'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        active
          ? 'border-brand text-brand'
          : 'border-transparent text-text-muted hover:text-text-primary hover:border-border-strong'
      )}
    >
      {children}
    </button>
  );
}

function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(TabsCtx);
  if (ctx.value !== value) return null;
  return (
    <div role="tabpanel" className={cn('pt-4', className)}>
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
