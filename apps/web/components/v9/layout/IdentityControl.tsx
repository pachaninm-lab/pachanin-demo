'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Sun, Moon, HelpCircle, Check, Rows2, AlignJustify } from 'lucide-react';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { trackRoleSwitch } from '@/lib/analytics/track';

const ROLES: PlatformRole[] = [
  'operator', 'buyer', 'seller', 'logistics', 'driver',
  'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
];

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

const ROLE_COLORS: Record<PlatformRole, string> = {
  operator: '#0A7A5F',
  buyer: '#0284C7',
  seller: '#16A34A',
  logistics: '#0E7490',
  driver: '#D97706',
  surveyor: '#7C3AED',
  elevator: '#0E7490',
  lab: '#BE185D',
  bank: '#1D4ED8',
  compliance: '#4B5563',
  executive: '#0F1419',
  arbitrator: '#6B21A8',
};

const ROLE_INITIALS: Record<PlatformRole, string> = {
  operator: 'ОП',
  buyer: 'ПК',
  seller: 'ПД',
  logistics: 'ЛГ',
  driver: 'ВД',
  surveyor: 'СЮ',
  elevator: 'ЭЛ',
  lab: 'ЛБ',
  bank: 'БК',
  compliance: 'КМ',
  executive: 'РК',
  arbitrator: 'АР',
};

const ROLE_ROUTES: Record<PlatformRole, string> = {
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

function RoleAvatar({ role }: { role: PlatformRole }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: ROLE_COLORS[role],
        color: '#fff',
        fontSize: 9,
        fontWeight: 900,
        letterSpacing: '0.03em',
        flexShrink: 0,
      }}
      aria-hidden
    >
      {ROLE_INITIALS[role]}
    </span>
  );
}

export function IdentityControl() {
  const router = useRouter();
  const { role, setRole } = usePlatformV7RStore();
  const [open, setOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const [density, setDensity] = React.useState<'spacious' | 'compact'>('spacious');
  const [isDesktop, setIsDesktop] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('pc-theme') : null;
    const next: 'light' | 'dark' = stored === 'dark' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);

    const storedDensity = window.localStorage.getItem('pc-density');
    const nextDensity: 'spacious' | 'compact' = storedDensity === 'compact' ? 'compact' : 'spacious';
    setDensity(nextDensity);
    document.documentElement.setAttribute('data-density', nextDensity);
  }, []);

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') window.localStorage.setItem('pc-theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const handleRoleClick = React.useCallback(
    (nextRole: PlatformRole) => {
      setRole(nextRole);
      trackRoleSwitch(nextRole);
      router.push(ROLE_ROUTES[nextRole]);
      setOpen(false);
    },
    [router, setRole],
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Идентификация и настройки"
        aria-expanded={open}
        aria-haspopup="true"
        style={{
          border: '1px solid var(--pc-border)',
          background: 'var(--pc-bg-card)',
          borderRadius: 14,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          minHeight: 36,
          boxShadow: 'var(--pc-shadow-sm)',
          color: 'var(--pc-text-primary)',
        }}
      >
        <RoleAvatar role={role} />
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary)' }}>
          {ROLE_LABELS[role]}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: 'var(--pc-text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 4,
            zIndex: 50,
            minWidth: 220,
            background: 'var(--pc-bg-card)',
            border: '1px solid var(--pc-border)',
            borderRadius: 8,
            boxShadow: 'var(--pc-shadow-lg, 0 8px 24px rgba(0,0,0,0.16))',
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          {ROLES.map((r) => (
            <button
              key={r}
              role="menuitem"
              onClick={() => handleRoleClick(r)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '7px 12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--pc-text-primary)',
                fontSize: 13,
                fontWeight: r === role ? 900 : 700,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-bg-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <RoleAvatar role={r} />
              <span style={{ flex: 1 }}>{ROLE_LABELS[r]}</span>
              {r === role && <Check size={14} style={{ color: 'var(--pc-accent, #0A7A5F)', flexShrink: 0 }} />}
            </button>
          ))}

          <div
            style={{
              height: 1,
              background: 'var(--pc-border)',
              margin: '4px 0',
            }}
          />

          <button
            role="menuitem"
            onClick={toggleTheme}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '7px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'var(--pc-text-primary)',
              fontSize: 13,
              fontWeight: 700,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-bg-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
          </button>

          <button
            role="menuitem"
            onClick={() => {
              const next = density === 'compact' ? 'spacious' : 'compact';
              setDensity(next);
              window.localStorage.setItem('pc-density', next);
              document.documentElement.setAttribute('data-density', next);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '7px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'var(--pc-text-primary)',
              fontSize: 13,
              fontWeight: 700,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-bg-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {density === 'compact' ? <AlignJustify size={15} /> : <Rows2 size={15} />}
            <span>{density === 'compact' ? 'Свободный вид' : 'Компактный вид'}</span>
          </button>

          {isDesktop && (
            <a
              role="menuitem"
              href="/platform-v7/help"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '7px 12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textDecoration: 'none',
                color: 'var(--pc-text-primary)',
                fontSize: 13,
                fontWeight: 700,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-bg-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <HelpCircle size={15} />
              <span>Помощь</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
