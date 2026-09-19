'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { BrandMark } from '@/components/v7r/BrandMark';

const NAV_ITEMS = [
  { href: '/lots', label: 'Лоты' },
  { href: '/deals', label: 'Сделки' },
  { href: '/dispatch', label: 'Логистика' },
  { href: '/payments', label: 'Платежи' },
  { href: '/documents', label: 'Документы' },
  { href: '/cabinet', label: 'Кабинет' },
];

const ROLE_LABELS: Record<string, string> = {
  FARMER: 'Фермер',
  BUYER: 'Покупатель',
  LOGISTICIAN: 'Логист',
  DRIVER: 'Водитель',
  LAB: 'Лаборатория',
  ELEVATOR: 'Элеватор',
  ACCOUNTING: 'Бухгалтерия',
  EXECUTIVE: 'Руководитель',
  SUPPORT_MANAGER: 'Оператор',
  ADMIN: 'Администратор',
};

function readRole(): string {
  if (typeof document === 'undefined') return '';
  const raw = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('pc_session_present='))
    ?.split('=')[1];
  if (!raw) return '';
  try {
    return JSON.parse(decodeURIComponent(raw)).role || '';
  } catch {
    return '';
  }
}

export function AppChrome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    setRole(readRole());
  }, [pathname]);

  const isActive = (href: string) => Boolean(pathname?.startsWith(href));

  const palette = {
    headerBg: 'var(--pc-bg-header, rgba(7, 12, 24, 0.96))',
    cardBg: 'var(--pc-bg-card, #0d1424)',
    elevatedBg: 'var(--pc-bg-elevated, #111a2e)',
    surfaceSoft: 'var(--pc-accent-bg, rgba(126, 242, 196, 0.12))',
    border: 'var(--pc-border, rgba(255,255,255,0.10))',
    borderStrong: 'var(--pc-accent-border, rgba(126, 242, 196, 0.22))',
    textPrimary: 'var(--pc-text-primary, #f1f5f9)',
    textSecondary: 'var(--pc-text-secondary, #cbd5e1)',
    textMuted: 'var(--pc-text-muted, #94a3b8)',
    accent: 'var(--pc-accent, #8EF4CF)',
    accentStrong: 'var(--pc-accent-strong, #DDF7EE)',
  };

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: palette.headerBg,
          borderBottom: `1px solid ${palette.border}`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div
          style={{
            maxWidth: 980,
            margin: '0 auto',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            height: 62,
            gap: 10,
          }}
        >
          <Link
            href='/demo'
            style={{
              textDecoration: 'none',
              flexShrink: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginRight: 6,
            }}
            aria-label='Прозрачная Цена'
          >
            <BrandMark size={40} rounded={14} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  color: palette.textMuted,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  fontWeight: 700,
                }}
              >
                Прозрачная Цена
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: palette.textPrimary,
                  lineHeight: 1.25,
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Контур исполнения зерновой сделки
              </div>
            </div>
          </Link>

          <nav className='app-desktop-nav' aria-label='Основная навигация'>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: active ? 800 : 600,
                    color: active ? palette.accentStrong : palette.textMuted,
                    background: active ? palette.surfaceSoft : 'transparent',
                    border: `1px solid ${active ? palette.borderStrong : 'transparent'}`,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'color 0.15s, background 0.15s, border-color 0.15s',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div style={{ flex: 1 }} />

          {role && (
            <a
              href='/demo'
              className='app-role-chip'
              style={{
                padding: '5px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                background: palette.surfaceSoft,
                border: `1px solid ${palette.borderStrong}`,
                color: palette.accentStrong,
                textDecoration: 'none',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                flexShrink: 0,
              }}
            >
              {ROLE_LABELS[role] || role}
            </a>
          )}

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            style={{
              background: menuOpen ? palette.surfaceSoft : 'transparent',
              border: `1px solid ${menuOpen ? palette.borderStrong : palette.border}`,
              borderRadius: 12,
              width: 38,
              height: 38,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              flexShrink: 0,
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {[0, 1, 2].map((line) => (
              <span
                key={line}
                style={{
                  display: 'block',
                  width: 18,
                  height: 2,
                  background: menuOpen ? palette.accent : palette.textSecondary,
                  borderRadius: 2,
                  transition: 'background 0.15s',
                }}
              />
            ))}
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 48,
              background: 'rgba(0,0,0,0.55)',
            }}
          />

          <div
            style={{
              position: 'fixed',
              top: 62,
              left: 0,
              right: 0,
              zIndex: 49,
              background: palette.cardBg,
              borderBottom: `1px solid ${palette.border}`,
              boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
            }}
          >
            {role && (
              <div
                style={{
                  padding: '12px 16px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: `1px solid ${palette.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: palette.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontWeight: 700,
                  }}
                >
                  Роль:
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: palette.accentStrong }}>
                  {ROLE_LABELS[role] || role}
                </span>
              </div>
            )}

            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '13px 16px',
                    borderBottom: `1px solid ${palette.border}`,
                    color: active ? palette.accentStrong : palette.textPrimary,
                    textDecoration: 'none',
                    fontSize: 15,
                    fontWeight: active ? 800 : 500,
                    background: active ? palette.surfaceSoft : 'transparent',
                  }}
                >
                  {item.label}
                  {active ? <span style={{ fontSize: 12, color: palette.accent }}>●</span> : null}
                </a>
              );
            })}

            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <a
                href='/demo'
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: palette.surfaceSoft,
                  border: `1px solid ${palette.borderStrong}`,
                  color: palette.accentStrong,
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                {role ? 'Сменить роль' : 'Войти в демо'}
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
