'use client';

import { useState } from 'react';

type Role = 'seller' | 'buyer' | 'operator' | 'lab' | 'driver' | 'bank' | 'investor';
type Permission = 'read' | 'write' | 'approve' | 'denied';

interface RbacEntry {
  resource: string;
  category: string;
  permissions: Record<Role, Permission>;
}

const ROLES: Array<{ id: Role; label: string; short: string }> = [
  { id: 'seller',   label: 'Продавец',  short: 'Прод' },
  { id: 'buyer',    label: 'Покупатель', short: 'Покуп' },
  { id: 'operator', label: 'Оператор',  short: 'Опер' },
  { id: 'lab',      label: 'Лаборатория', short: 'Лаб' },
  { id: 'driver',   label: 'Водитель',  short: 'Вод' },
  { id: 'bank',     label: 'Банк',      short: 'Банк' },
  { id: 'investor', label: 'Инвестор',  short: 'Инв' },
];

const MATRIX: RbacEntry[] = [
  { resource: 'Лоты: просмотр',         category: 'Лоты',      permissions: { seller: 'read',   buyer: 'read',   operator: 'read',   lab: 'denied', driver: 'denied', bank: 'read',   investor: 'read' } },
  { resource: 'Лоты: создание',         category: 'Лоты',      permissions: { seller: 'write',  buyer: 'denied', operator: 'write',  lab: 'denied', driver: 'denied', bank: 'denied', investor: 'denied' } },
  { resource: 'Лоты: закрытие',         category: 'Лоты',      permissions: { seller: 'approve', buyer: 'denied', operator: 'approve', lab: 'denied', driver: 'denied', bank: 'denied', investor: 'denied' } },

  { resource: 'Сделки: просмотр',       category: 'Сделки',    permissions: { seller: 'read',   buyer: 'read',   operator: 'read',   lab: 'read',   driver: 'read',   bank: 'read',   investor: 'read' } },
  { resource: 'Сделки: изменение статуса', category: 'Сделки', permissions: { seller: 'denied', buyer: 'denied', operator: 'approve', lab: 'denied', driver: 'denied', bank: 'approve', investor: 'denied' } },
  { resource: 'Выпуск денег',           category: 'Сделки',    permissions: { seller: 'denied', buyer: 'denied', operator: 'denied', lab: 'denied', driver: 'denied', bank: 'approve', investor: 'denied' } },

  { resource: 'Документы: просмотр',    category: 'Документы', permissions: { seller: 'read',   buyer: 'read',   operator: 'read',   lab: 'read',   driver: 'read',   bank: 'read',   investor: 'denied' } },
  { resource: 'Документы: загрузка',    category: 'Документы', permissions: { seller: 'write',  buyer: 'write',  operator: 'write',  lab: 'write',  driver: 'write',  bank: 'denied', investor: 'denied' } },
  { resource: 'Подписание УКЭП',        category: 'Документы', permissions: { seller: 'approve', buyer: 'approve', operator: 'denied', lab: 'approve', driver: 'approve', bank: 'denied', investor: 'denied' } },

  { resource: 'Споры: создание',        category: 'Споры',     permissions: { seller: 'write',  buyer: 'write',  operator: 'write',  lab: 'denied', driver: 'denied', bank: 'denied', investor: 'denied' } },
  { resource: 'Споры: решение',         category: 'Споры',     permissions: { seller: 'denied', buyer: 'denied', operator: 'approve', lab: 'denied', driver: 'denied', bank: 'denied', investor: 'denied' } },

  { resource: 'Протокол качества',      category: 'Лаборатория', permissions: { seller: 'denied', buyer: 'denied', operator: 'read',  lab: 'write',  driver: 'denied', bank: 'read',   investor: 'denied' } },

  { resource: 'Маршрут: просмотр',      category: 'Логистика', permissions: { seller: 'read',   buyer: 'read',   operator: 'read',   lab: 'denied', driver: 'read',   bank: 'read',   investor: 'denied' } },
  { resource: 'ЭТрН: подписание',       category: 'Логистика', permissions: { seller: 'denied', buyer: 'denied', operator: 'denied', lab: 'denied', driver: 'approve', bank: 'denied', investor: 'denied' } },

  { resource: 'Аудит-лог',             category: 'Безопасность', permissions: { seller: 'denied', buyer: 'denied', operator: 'read', lab: 'denied', driver: 'denied', bank: 'denied', investor: 'denied' } },
  { resource: 'Управление ролями',      category: 'Безопасность', permissions: { seller: 'denied', buyer: 'denied', operator: 'approve', lab: 'denied', driver: 'denied', bank: 'denied', investor: 'denied' } },
  { resource: 'Отзывы и рейтинги',      category: 'Платформа',  permissions: { seller: 'read',   buyer: 'write',  operator: 'read',   lab: 'denied', driver: 'denied', bank: 'denied', investor: 'read' } },
];

const PERM_CONFIG: Record<Permission, { label: string; symbol: string; bg: string; color: string }> = {
  read:    { label: 'Чтение',    symbol: 'R',   bg: 'rgba(37,99,235,0.08)',  color: '#2563EB' },
  write:   { label: 'Запись',    symbol: 'W',   bg: 'rgba(217,119,6,0.1)',   color: '#B45309' },
  approve: { label: 'Подтвержд', symbol: '✓',   bg: 'rgba(10,122,95,0.1)',   color: '#0A7A5F' },
  denied:  { label: 'Запрещено', symbol: '—',   bg: 'rgba(100,116,139,0.06)', color: '#CBD5E1' },
};

const CATEGORIES = Array.from(new Set(MATRIX.map((r) => r.category)));

export function RbacMatrix() {
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filtered = activeCategory === 'all'
    ? MATRIX
    : MATRIX.filter((r) => r.category === activeCategory);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Обозначения:</span>
        {Object.entries(PERM_CONFIG).map(([k, v]) => (
          <span key={k} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: v.bg, color: v.color }}>
            {v.symbol} {v.label}
          </span>
        ))}
      </div>

      {/* Role filter chips */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--pc-text-muted)', marginRight: 2 }}>Роль:</span>
        <button
          onClick={() => setActiveRole(null)}
          style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, cursor: 'pointer', background: activeRole === null ? 'var(--p7-color-brand, #0A7A5F)' : 'transparent', color: activeRole === null ? '#fff' : 'var(--pc-text-muted)', border: `1px solid ${activeRole === null ? 'transparent' : 'var(--p7-color-border)'}` }}
        >
          Все
        </button>
        {ROLES.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveRole(activeRole === r.id ? null : r.id)}
            style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, cursor: 'pointer', background: activeRole === r.id ? 'var(--p7-color-brand, #0A7A5F)' : 'transparent', color: activeRole === r.id ? '#fff' : 'var(--pc-text-muted)', border: `1px solid ${activeRole === r.id ? 'transparent' : 'var(--p7-color-border)'}` }}
          >
            {r.short}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--pc-text-muted)', marginRight: 2 }}>Раздел:</span>
        {['all', ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, cursor: 'pointer', background: activeCategory === cat ? '#2563EB' : 'transparent', color: activeCategory === cat ? '#fff' : 'var(--pc-text-muted)', border: `1px solid ${activeCategory === cat ? 'transparent' : 'var(--p7-color-border)'}` }}
          >
            {cat === 'all' ? 'Все' : cat}
          </button>
        ))}
      </div>

      {/* Matrix table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 700, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', background: 'var(--p7-color-surface-muted)', borderRadius: '6px 0 0 0', minWidth: 180, position: 'sticky', left: 0, zIndex: 1 }}>
                Ресурс
              </th>
              {(activeRole ? ROLES.filter((r) => r.id === activeRole) : ROLES).map((r) => (
                <th key={r.id} style={{ padding: '6px 10px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--p7-color-surface-muted)', minWidth: 72 }}>
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row.resource} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--pc-text-secondary)', borderBottom: '1px solid var(--p7-color-border)', position: 'sticky', left: 0, background: i % 2 === 0 ? 'var(--pc-bg, #fff)' : 'rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--pc-text-muted)', minWidth: 60 }}>{row.category}</span>
                    <span>{row.resource}</span>
                  </div>
                </td>
                {(activeRole ? ROLES.filter((r) => r.id === activeRole) : ROLES).map((r) => {
                  const perm = row.permissions[r.id];
                  const cfg = PERM_CONFIG[perm];
                  return (
                    <td key={r.id} style={{ padding: '5px 10px', textAlign: 'center', borderBottom: '1px solid var(--p7-color-border)' }}>
                      <span
                        title={cfg.label}
                        style={{ display: 'inline-block', width: 24, height: 24, lineHeight: '24px', borderRadius: 6, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 900, textAlign: 'center' }}
                      >
                        {cfg.symbol}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', padding: '6px 10px', borderRadius: 8, background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }}>
        RBAC-матрица — демо-данные. В боевом контуре права управляются через CASL/casbin с JWT-клеймами. Каждый запрос проверяется сервером независимо от UI.
      </div>
    </div>
  );
}
