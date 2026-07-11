'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const LABELS = {
  ru: 'Центр управления доступом',
  en: 'Access Control Center',
  zh: '访问控制中心',
} as const;

type Assignment = { status?: string };

export function StaffControlCenterEntry() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const findTarget = () => {
      if (cancelled) return;
      const target = document.querySelector('.pc-v4-actions');
      if (target) setPortalTarget(target);
      else window.setTimeout(findTarget, 50);
    };
    findTarget();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/staff/assignments/me', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => response.ok ? response.json() : [])
      .then((rows: Assignment[]) => {
        const assignments = Array.isArray(rows) ? rows : [];
        setVisible(assignments.some((item) => ['ACTIVE', 'ELIGIBLE'].includes(String(item.status || ''))));
      })
      .catch(() => setVisible(false));
    return () => controller.abort();
  }, []);

  if (!visible || !portalTarget) return null;

  const queryLocale = searchParams.get('lang');
  const documentLocale = typeof document !== 'undefined' ? document.documentElement.lang : 'ru';
  const locale = queryLocale === 'en' || queryLocale === 'zh' || queryLocale === 'ru'
    ? queryLocale
    : documentLocale.startsWith('en') ? 'en' : documentLocale.startsWith('zh') ? 'zh' : 'ru';
  const label = LABELS[locale];
  const active = pathname === '/platform-v7/staff' || pathname.startsWith('/platform-v7/staff/');

  return createPortal(
    <Link
      href={`/platform-v7/staff?lang=${locale}`}
      className="pc-v4-icon pc-v4-staff-entry"
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
      data-p7-no-translate="true"
      style={active ? { background: 'rgba(23, 86, 63, .12)', borderColor: 'rgba(23, 86, 63, .28)' } : undefined}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3 5.5 5.7v5.1c0 4.5 2.7 8.1 6.5 10.2 3.8-2.1 6.5-5.7 6.5-10.2V5.7L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9.2 11.3 11 13l3.9-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>,
    portalTarget,
  );
}
