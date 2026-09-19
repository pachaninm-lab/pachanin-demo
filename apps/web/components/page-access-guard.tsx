'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { toSurfaceRole } from '../../../shared/role-contract';

type PageAccessGuardProps = {
  allowedRoles?: string[];
  title?: string;
  subtitle?: string;
  internal?: boolean;
  children: ReactNode;
};

const DEMO_ROLES = [
  { email: 'farmer@demo.ru',     label: 'Фермер',      icon: '🌾', page: '/lots' },
  { email: 'buyer@demo.ru',      label: 'Покупатель',  icon: '🏢', page: '/deals' },
  { email: 'operator@demo.ru',   label: 'Оператор',    icon: '⚙️', page: '/operator-cockpit' },
  { email: 'admin@demo.ru',      label: 'Админ',       icon: '🔑', page: '/cabinet' },
  { email: 'lab@demo.ru',        label: 'Лаборатория', icon: '🧪', page: '/lab' },
  { email: 'accounting@demo.ru', label: 'Бухгалтерия', icon: '📊', page: '/payments' },
];

function readRoleFromCookie(): string {
  if (typeof document === 'undefined') return 'GUEST';
  const raw = document.cookie
    .split(';').map((c) => c.trim())
    .find((c) => c.startsWith('pc_session_present='))
    ?.split('=')[1];
  if (!raw) return 'GUEST';
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return typeof parsed.role === 'string' ? parsed.role : 'GUEST';
  } catch { return 'GUEST'; }
}

function DemoLoginBlock({ returnTo }: { returnTo: string }) {
  return (
    <div style={{
      maxWidth: 500, margin: '60px auto 0', padding: '0 16px',
    }}>
      <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Демо-режим</h2>
        <p style={{ margin: '0 0 24px', fontSize: 14 }}>
          Выберите роль — войдёте без пароля и регистрации
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {DEMO_ROLES.map((r) => (
            <a
              key={r.email}
              href={`/api/auth/demo?email=${r.email}&to=${returnTo || r.page}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                borderRadius: 10, padding: '10px 12px',
                color: 'var(--text-1)', textDecoration: 'none',
                fontSize: 13, fontWeight: 600,
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: 18 }}>{r.icon}</span>
              {r.label}
            </a>
          ))}
        </div>
        <a href="/demo" style={{
          display: 'block', marginTop: 16, fontSize: 12,
          color: 'var(--text-3)', textDecoration: 'none',
        }}>
          Все роли →
        </a>
      </div>
    </div>
  );
}

export function PageAccessGuard({
  allowedRoles = [],
  title,
  subtitle,
  internal = false,
  children,
}: PageAccessGuardProps) {
  const pathname = usePathname();
  const [role, setRole] = useState<string>('GUEST');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setRole(readRoleFromCookie());
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!allowedRoles || allowedRoles.length === 0) return <>{children}</>;

  const normalizedRole = toSurfaceRole(role);
  const allowed = allowedRoles.map((r) => toSurfaceRole(r));
  const hasAccess = allowed.includes(normalizedRole);

  if (hasAccess) {
    return (
      <div data-allowed-roles={allowedRoles.join(',')} data-internal={internal ? 'true' : 'false'}>
        {children}
      </div>
    );
  }

  if (normalizedRole === 'GUEST') {
    return <DemoLoginBlock returnTo={encodeURIComponent(pathname || '/')} />;
  }

  return (
    <div className="page-surface">
      <div className="card" style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⛔</div>
        <div className="section-title">{title || 'Доступ ограничен'}</div>
        <p style={{ marginTop: 8 }}>
          {subtitle || `Роль ${normalizedRole} не имеет доступа к этому разделу.`}
        </p>
        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/demo" className="primary-button">Сменить роль</a>
          <a href="/cabinet" className="secondary-link">Кабинет</a>
        </div>
      </div>
    </div>
  );
}
