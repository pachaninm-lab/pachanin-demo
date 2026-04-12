'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search, Bot } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { RoleSwitcher } from './RoleSwitcher';
import { SandboxBadge } from '../bank/SandboxBadge';
import { cn } from '@/lib/v9/utils';

function buildBreadcrumbs(pathname: string) {
  const labels: Record<string, string> = {
    'platform-v9': 'v9',
    'control-tower': 'Control Tower',
    'deals': 'Сделки',
    'buyer': 'Покупатель',
    'seller': 'Продавец',
    'bank': 'Банк',
    'disputes': 'Споры',
    'field': 'Поле',
    'compliance': 'Комплаенс',
    'admin': 'Администрирование',
  };

  const parts = pathname.split('/').filter(Boolean);
  return parts.map((part, i) => ({
    label: labels[part] ?? part,
    href: '/' + parts.slice(0, i + 1).join('/'),
    isLast: i === parts.length - 1,
  }));
}

export function Header() {
  const pathname = usePathname();
  const { toggleSidebar } = useSessionStore();
  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <header className="v9-header" role="banner">
      {/* Mobile menu toggle */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-2 rounded-md hover:bg-muted text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label="Открыть навигацию"
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumbs */}
      <nav aria-label="Хлебные крошки" className="flex items-center gap-1 flex-1 min-w-0">
        {breadcrumbs.map(({ label, href, isLast }, i) => (
          <React.Fragment key={href}>
            {i > 0 && (
              <span className="text-text-muted text-xs" aria-hidden>/</span>
            )}
            {isLast ? (
              <span className="text-sm font-semibold text-text-primary truncate">{label}</span>
            ) : (
              <Link
                href={href}
                className="text-sm text-text-muted hover:text-text-primary truncate transition-colors"
              >
                {label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Search hint */}
      <button
        className={cn(
          'hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-text-muted',
          'border border-border bg-muted hover:bg-[#eaecef] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
        )}
        aria-label="Поиск по сделкам (⌘K)"
      >
        <Search size={13} aria-hidden />
        <span className="text-xs">Поиск сделок</span>
        <kbd className="ml-1 text-[10px] font-mono bg-surface border border-border px-1 py-0.5 rounded">⌘K</kbd>
      </button>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <SandboxBadge className="hidden sm:inline-flex" />

        <button
          className={cn(
            'p-2 rounded-md text-text-muted hover:bg-muted transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
          )}
          aria-label="AI-помощник (⌘K)"
          title="AI-помощник"
        >
          <Bot size={18} />
        </button>

        <RoleSwitcher />
      </div>
    </header>
  );
}
