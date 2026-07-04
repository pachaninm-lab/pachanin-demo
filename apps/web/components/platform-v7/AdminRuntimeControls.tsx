'use client';

import * as React from 'react';

// Реальные, работающие административные действия над ЛОКАЛЬНЫМ рантаймом демо.
// Честно: это управление демонстрационным состоянием в браузере (persisted-сторы
// zustand, тема, кэш выбора роли), а не серверными данными — серверный контур
// требует развёртывания API (см. docs/PATH_TO_PRODUCTION.md). Всё, что здесь
// есть, действительно исполняется, без имитации.

const PERSIST_KEYS = [
  'pc-buyer-runtime-v2',
  'pc-commercial-runtime-v1',
  'pc-field-runtime-v1',
  'pc-live-deal-runtime-v1',
  'pc-session-v10',
  'platform-v7-header-notepad',
];

function Row({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--pc-space-3)',
        padding: 'var(--pc-space-3) var(--pc-space-4)',
        borderRadius: 'var(--pc-radius-md)',
        border: '1px solid var(--pc-border)',
        background: 'var(--pc-bg-elevated)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pc-text-primary)' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--pc-text-muted)', lineHeight: 1.4, marginTop: 2 }}>{note}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Btn({ onClick, children, tone = 'default' }: { onClick: () => void; children: React.ReactNode; tone?: 'default' | 'danger' }) {
  const danger = tone === 'danger';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 44,
        padding: '0 var(--pc-space-4)',
        borderRadius: 'var(--pc-radius-sm)',
        border: `1px solid ${danger ? 'var(--pc-danger)' : 'var(--pc-border-strong)'}`,
        background: danger ? 'var(--pc-danger-bg)' : 'var(--pc-bg-card)',
        color: danger ? 'var(--pc-danger)' : 'var(--pc-text-primary)',
        fontSize: 13.5,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function AdminRuntimeControls() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const [storeCount, setStoreCount] = React.useState<number | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTheme((document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light');
    setStoreCount(PERSIST_KEYS.filter((k) => window.localStorage.getItem(k) !== null).length);
  }, []);

  const say = (m: string) => {
    setFlash(m);
    window.setTimeout(() => setFlash(null), 2600);
  };

  const resetDemoState = () => {
    PERSIST_KEYS.forEach((k) => window.localStorage.removeItem(k));
    window.sessionStorage.clear();
    say('Локальное демо-состояние сброшено. Обновление страницы…');
    window.setTimeout(() => window.location.reload(), 900);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    window.localStorage.setItem('pc-theme', next);
    setTheme(next);
    say(`Тема переключена: ${next === 'dark' ? 'тёмная' : 'светлая'}`);
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--pc-space-3)' }}>
      <Row title="Демо-состояние в браузере" note={storeCount === null ? 'Проверка…' : `${storeCount} сохранённых стора · localStorage + sessionStorage`}>
        <Btn onClick={resetDemoState} tone="danger">Сбросить демо</Btn>
      </Row>
      <Row title="Тема оформления" note="Светлая / тёмная — применяется мгновенно ко всему кабинету">
        <Btn onClick={toggleTheme}>{theme === 'dark' ? 'Включить светлую' : 'Включить тёмную'}</Btn>
      </Row>
      {flash && (
        <div
          role="status"
          style={{
            padding: 'var(--pc-space-2) var(--pc-space-3)',
            borderRadius: 'var(--pc-radius-sm)',
            background: 'var(--pc-success-bg)',
            color: 'var(--pc-success)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {flash}
        </div>
      )}
    </div>
  );
}
