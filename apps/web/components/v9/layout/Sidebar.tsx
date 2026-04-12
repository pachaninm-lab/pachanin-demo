'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, ShoppingCart, Wheat, Landmark,
  Scale, MapPin, Shield, Settings, Layers,
} from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { getNavItems } from '@/lib/v9/roles';
import { cn } from '@/lib/v9/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const iconMap: Record<string, React.ComponentType<any>> = {
  LayoutDashboard, FileText, ShoppingCart, Wheat, Landmark,
  Scale, MapPin, Shield, Settings, Layers,
};

export function Sidebar() {
  const pathname = usePathname();
  const role = useSessionStore(s => s.role);
  const navItems = getNavItems(role);

  return (
    <aside
      className="v9-sidebar"
      aria-label="Основная навигация"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div
          aria-hidden
          style={{
            width: 32,
            height: 32,
            background: '#0A7A5F',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Layers size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0F1419', lineHeight: 1.2 }}>
            Прозрачная Цена
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B778C', letterSpacing: '0.06em' }}>
            v9 · PLATFORM
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Разделы платформы" className="flex-1 px-2 py-3 overflow-y-auto">
        <div className="v9-section-label mb-2">Рабочие разделы</div>
        {navItems.map(item => {
          const Icon = iconMap[item.icon] ?? LayoutDashboard;
          const isActive =
            pathname === item.href ||
            (pathname.startsWith(item.href + '/') && item.href !== '/platform-v9');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('v9-nav-item', isActive && 'active')}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={16} className="v9-nav-icon" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <Link
          href="/platform-v7"
          className="v9-nav-item text-[11px] text-text-muted"
          aria-label="Вернуться к платформе v7"
        >
          ← Платформа v7
        </Link>
      </div>
    </aside>
  );
}
