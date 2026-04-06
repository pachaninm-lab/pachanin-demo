'use client';

import Link from 'next/link';
import { useMemo } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Главная' },
  { href: '/control', label: 'Контроль' },
  { href: '/deals', label: 'Сделки' },
  { href: '/logistics', label: 'Логистика' },
  { href: '/payments', label: 'Платежи' },
  { href: '/documents', label: 'Документы' },
];

export function AppChrome() {
  const items = useMemo(() => NAV_ITEMS, []);

  return (
    <header className="sticky top-0 z-30 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(7,10,17,0.92)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Прозрачная Цена</div>
          <div className="truncate text-sm font-semibold text-white">Execution rail</div>
        </div>
        <nav className="hidden items-center gap-2 md:flex">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-full px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
          operator-ready shell
        </div>
      </div>
    </header>
  );
}
