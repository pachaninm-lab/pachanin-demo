'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, ShoppingCart, Wheat, Landmark,
  Scale, MapPin, Shield, Settings, Layers, Bot, ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { getNavItems, roleLabels } from '@/lib/v9/roles';
import { cn } from '@/lib/v9/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const iconMap: Record<string, React.ComponentType<any>> = {
  LayoutDashboard, FileText, ShoppingCart, Wheat, Landmark,
  Scale, MapPin, Shield, Settings, Layers, ClipboardList,
};

interface SidebarProps {
  aiOpen?: boolean;
  onToggleAi?: () => void;
}

export function Sidebar({ aiOpen, onToggleAi }: SidebarProps) {
  const pathname = usePathname();
  const { role, sidebarOpen, setSidebarOpen } = useSessionStore();
  const navItems = getNavItems(role);

  return (
    <aside
      className={cn(
        'v9-sidebar',
        // Mobile: hidden by default, show as overlay when open
        !sidebarOpen ? 'max-lg:hidden' : 'max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:z-50 max-lg:w-[280px] max-lg:shadow-lg'
      )}
      aria-label="Основная навигация"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div aria-hidden style={{ width: 32, height: 32, background: '#0A7A5F', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Layers size={18} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0F1419', lineHeight: 1.2 }}>Прозрачная Цена</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B778C', letterSpacing: '0.06em' }}>v9 · PLATFORM</div>
        </div>
        <button className="lg:hidden text-text-muted hover:text-text-primary" onClick={() => setSidebarOpen(false)} aria-label="Закрыть меню">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Role context */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #E4E6EA', background: 'rgba(10,122,95,0.03)' }}>
        <div style={{ fontSize: 11, color: '#6B778C', fontWeight: 600 }}>
          Текущая роль:
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0A7A5F', marginTop: 1 }}>
          {roleLabels[role]}
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Разделы платформы" className="flex-1 px-2 py-3 overflow-y-auto">
        <div className="v9-section-label mb-2">Рабочие разделы</div>
        {navItems.map(item => {
          const Icon = iconMap[item.icon] ?? LayoutDashboard;
          const isActive =
            pathname === item.href ||
            (pathname.startsWith(item.href + '/') && item.href !== '/platform-v7');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('v9-nav-item', isActive && 'active')}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={16} className="v9-nav-icon" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* AI assistant shortcut */}
      <div style={{ padding: '8px', borderTop: '1px solid #E4E6EA' }}>
        <button
          onClick={onToggleAi}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: aiOpen ? 'rgba(10,122,95,0.08)' : 'transparent',
            color: aiOpen ? '#0A7A5F' : '#6B778C',
            fontSize: 13, fontWeight: 500, textAlign: 'left',
            transition: 'background 0.1s',
          }}
          aria-pressed={aiOpen}
        >
          <Bot size={16} aria-hidden />
          AI-помощник
          <kbd style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 4px', background: '#F4F5F7', border: '1px solid #E4E6EA', borderRadius: 3, fontFamily: 'monospace' }}>
            ⌘I
          </kbd>
        </button>

      </div>
    </aside>
  );
}
