'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toSurfaceRole } from '../../../shared/role-contract';

type PageAccessGuardProps = {
  allowedRoles?: string[];
  title?: string;
  subtitle?: string;
  internal?: boolean;
  children: ReactNode;
};

function readRoleFromCookie(): string {
  if (typeof document === 'undefined') return 'GUEST';
  const raw = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('pc_session_present='))
    ?.split('=')[1];
  if (!raw) return 'GUEST';
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return typeof parsed.role === 'string' ? parsed.role : 'GUEST';
  } catch {
    return 'GUEST';
  }
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

  // While reading cookie — show nothing to avoid flash of restricted content
  if (!checked) return null;

  // No restrictions configured — open to all
  if (!allowedRoles || allowedRoles.length === 0) {
    return <>{children}</>;
  }

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

  // Not authenticated — redirect to login
  if (normalizedRole === 'GUEST') {
    const returnTo = encodeURIComponent(pathname || '/');
    return (
      <div className="page-surface">
        <div className="section-card-tight" style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
          <div className="section-title">{title || 'Требуется авторизация'}</div>
          <div className="muted small" style={{ marginTop: 8 }}>
            {subtitle || 'Войдите в систему, чтобы получить доступ к этому разделу.'}
          </div>
          <div style={{ marginTop: 20 }}>
            <Link href={`/login?returnTo=${returnTo}`} className="primary-link">Войти</Link>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated but wrong role
  return (
    <div className="page-surface">
      <div className="section-card-tight" style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⛔</div>
        <div className="section-title">{title || 'Доступ ограничен'}</div>
        <div className="muted small" style={{ marginTop: 8 }}>
          {subtitle || `Ваша роль (${normalizedRole}) не имеет доступа к этому разделу.`}
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link href="/cabinet" className="primary-link">Мой кабинет</Link>
          <Link href="/" className="secondary-link">На главную</Link>
        </div>
      </div>
    </div>
  );
}
