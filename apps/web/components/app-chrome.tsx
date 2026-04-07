'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/lots',      label: 'Лоты' },
  { href: '/deals',     label: 'Сделки' },
  { href: '/dispatch',  label: 'Логистика' },
  { href: '/payments',  label: 'Платежи' },
  { href: '/documents', label: 'Документы' },
  { href: '/cabinet',   label: 'Кабинет' },
];

const ROLE_LABELS: Record<string, string> = {
  FARMER:          'Фермер',
  BUYER:           'Покупатель',
  LOGISTICIAN:     'Логист',
  DRIVER:          'Водитель',
  LAB:             'Лаборатория',
  ELEVATOR:        'Элеватор',
  ACCOUNTING:      'Бухгалтерия',
  EXECUTIVE:       'Руководитель',
  SUPPORT_MANAGER: 'Оператор',
  ADMIN:           'Администратор',
};

function readRole(): string {
  if (typeof document === 'undefined') return '';
  const raw = document.cookie.split(';').map((c) => c.trim())
    .find((c) => c.startsWith('pc_session_present='))?.split('=')[1];
  if (!raw) return '';
  try { return JSON.parse(decodeURIComponent(raw)).role || ''; } catch { return ''; }
}

export function AppChrome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    setRole(readRole());
  }, [pathname]);

  const isActive = (href: string) => pathname?.startsWith(href);

  return (
    <>
      {/* ====== HEADER ====== */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,12,24,0.96)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        <div style={{
          maxWidth: 980, margin: '0 auto',
          padding: '0 16px',
          display: 'flex', alignItems: 'center',
          height: 58, gap: 8,
        }}>

          {/* Logo */}
          <Link href="/demo" style={{ textDecoration: 'none', flexShrink: 0, marginRight: 8 }}>
            <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1 }}>
              Прозрачная Цена
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3, marginTop: 2 }}>
              Зерновая биржа
            </div>
          </Link>

          {/* Desktop nav — hidden on mobile via CSS class */}
          <nav className="app-desktop-nav" aria-label="Основная навигация">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: isActive(item.href) ? 700 : 500,
                  color: isActive(item.href) ? '#38bdf8' : '#94a3b8',
                  background: isActive(item.href) ? 'rgba(56,189,248,0.1)' : 'transparent',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'color 0.15s, background 0.15s',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Role chip (desktop only) */}
          {role && (
            <a
              href="/demo"
              className="app-role-chip"
              style={{
                padding: '4px 10px',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(56,189,248,0.12)',
                border: '1px solid rgba(56,189,248,0.25)',
                color: '#38bdf8',
                textDecoration: 'none',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                flexShrink: 0,
              }}
            >
              {ROLE_LABELS[role] || role}
            </a>
          )}

          {/* Hamburger button */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            style={{
              background: menuOpen ? 'rgba(56,189,248,0.1)' : 'transparent',
              border: `1px solid ${menuOpen ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              width: 36, height: 36,
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
            <span style={{ display: 'block', width: 18, height: 2, background: menuOpen ? '#38bdf8' : '#94a3b8', borderRadius: 2, transition: 'background 0.15s' }} />
            <span style={{ display: 'block', width: 18, height: 2, background: menuOpen ? '#38bdf8' : '#94a3b8', borderRadius: 2, transition: 'background 0.15s' }} />
            <span style={{ display: 'block', width: 18, height: 2, background: menuOpen ? '#38bdf8' : '#94a3b8', borderRadius: 2, transition: 'background 0.15s' }} />
          </button>
        </div>
      </header>

      {/* ====== MOBILE MENU OVERLAY ====== */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 48,
              background: 'rgba(0,0,0,0.55)',
            }}
          />

          {/* Drawer */}
          <div style={{
            position: 'fixed', top: 58, left: 0, right: 0, zIndex: 49,
            background: '#0d1424',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }}>
            {/* Current role */}
            {role && (
              <div style={{
                padding: '12px 16px 8px',
                display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                  Роль:
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>
                  {ROLE_LABELS[role] || role}
                </span>
              </div>
            )}

            {/* Nav links */}
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: isActive(item.href) ? '#38bdf8' : '#e2e8f0',
                  textDecoration: 'none',
                  fontSize: 15, fontWeight: isActive(item.href) ? 700 : 400,
                  background: isActive(item.href) ? 'rgba(56,189,248,0.05)' : 'transparent',
                }}
              >
                {item.label}
                {isActive(item.href) && (
                  <span style={{ fontSize: 12, color: '#38bdf8' }}>●</span>
                )}
              </a>
            ))}

            {/* Footer actions */}
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <a
                href="/demo"
                style={{
                  flex: 1, textAlign: 'center',
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(56,189,248,0.1)',
                  border: '1px solid rgba(56,189,248,0.25)',
                  color: '#38bdf8', textDecoration: 'none',
                  fontSize: 14, fontWeight: 600,
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
