'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileSearch2 } from 'lucide-react';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const ACTIVE_ROLE_KEY = 'pc-v7-active-role';

const ROLE_HOME: Record<PlatformRole, string> = {
  operator: '/platform-v7/control-tower',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver',
  surveyor: '/platform-v7/surveyor',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  bank: '/platform-v7/bank',
  arbitrator: '/platform-v7/arbitrator',
  compliance: '/platform-v7/compliance',
  executive: '/platform-v7/executive',
};

const ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логистика',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  bank: 'Банк',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
  executive: 'Руководитель',
};

const ROLE_ACTIONS: Record<PlatformRole, Array<{ label: string; href: string; note: string }>> = {
  operator: [
    { label: 'Центр', href: '/platform-v7/control-tower', note: 'очередь по риску' },
    { label: 'Сделки', href: '/platform-v7/deals', note: 'активные сделки' },
    { label: 'Споры', href: '/platform-v7/disputes', note: 'расхождения' },
  ],
  buyer: [
    { label: 'Запросы', href: '/platform-v7/buyer/rfq', note: 'потребность' },
    { label: 'Офферы', href: '/platform-v7/proposals', note: 'условия' },
    { label: 'Деньги', href: '/platform-v7/money', note: 'резерв' },
  ],
  seller: [
    { label: 'Партии', href: '/platform-v7/seller/lots', note: 'зерно' },
    { label: 'Отгрузки', href: '/platform-v7/seller/batches', note: 'рейсы' },
    { label: 'Документы', href: '/platform-v7/documents', note: 'пакет' },
  ],
  logistics: [
    { label: 'Рейсы', href: '/platform-v7/logistics', note: 'маршрут' },
    { label: 'Документы', href: '/platform-v7/documents?scope=transport', note: 'транспорт' },
  ],
  driver: [{ label: 'Маршрут', href: '/platform-v7/driver', note: 'текущий рейс' }],
  surveyor: [{ label: 'Осмотр', href: '/platform-v7/surveyor', note: 'факты' }],
  elevator: [{ label: 'Приёмка', href: '/platform-v7/elevator', note: 'вес и акт' }],
  lab: [{ label: 'Пробы', href: '/platform-v7/lab', note: 'качество' }],
  bank: [
    { label: 'Основание', href: '/platform-v7/bank', note: 'проверка' },
    { label: 'События', href: '/platform-v7/bank/events', note: 'журнал' },
  ],
  arbitrator: [{ label: 'Арбитраж', href: '/platform-v7/arbitrator', note: 'спор' }],
  compliance: [{ label: 'Допуск', href: '/platform-v7/compliance', note: 'сторона' }],
  executive: [
    { label: 'Сводка', href: '/platform-v7/executive', note: 'картина' },
    { label: 'Деньги', href: '/platform-v7/money', note: 'риск' },
    { label: 'Сделки', href: '/platform-v7/deals', note: 'исполнение' },
  ],
};

function readActiveRole(fallback: PlatformRole): PlatformRole {
  if (typeof window === 'undefined') return fallback;
  const stored = window.sessionStorage.getItem(ACTIVE_ROLE_KEY) as PlatformRole | null;
  return stored && ROLE_HOME[stored] ? stored : fallback;
}

function safeFrom(role: PlatformRole, from: string) {
  return from.startsWith('/platform-v7') ? from : ROLE_HOME[role];
}

export default function PlatformV7AiPage() {
  const searchParams = useSearchParams();
  const storeRole = usePlatformV7RStore((state) => state.role);
  const [activeRole, setActiveRole] = React.useState<PlatformRole>(storeRole || 'operator');

  React.useEffect(() => {
    setActiveRole(readActiveRole(storeRole || 'operator'));
  }, [storeRole]);

  const from = safeFrom(activeRole, searchParams.get('from') || ROLE_HOME[activeRole]);
  const question = searchParams.get('q') || 'Какой следующий рабочий шаг?';
  const actions = ROLE_ACTIONS[activeRole] || ROLE_ACTIONS.operator;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section style={{ background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 20, padding: 16, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent)' }}>
            <FileSearch2 size={19} strokeWidth={2.1} />
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 22, fontWeight: 920, color: 'var(--pc-text-primary)' }}>Разбор шага</div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', lineHeight: 1.45 }}>{ROLE_LABELS[activeRole]} · только разрешённые действия роли</div>
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 20, padding: 16, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{question}</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--pc-text-secondary)' }}>Источник: {from}</div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          {actions.map((action) => (
            <Link key={action.href} href={action.href} style={{ display: 'grid', gap: 3, minWidth: 150, textDecoration: 'none', padding: '11px 13px', borderRadius: 15, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)', color: 'var(--pc-text-primary)' }}>
              <strong style={{ fontSize: 13 }}>{action.label}</strong>
              <span style={{ fontSize: 11, color: 'var(--pc-text-muted)', lineHeight: 1.3 }}>{action.note}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
