'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import type { AppLocale } from '@/i18n/locale';
import type { StaffOperationalWorkspaceCopy } from '@/i18n/staff-operational-workspace-messages';

const DeferredWorkspaces = dynamic(
  () => import('./StaffOperationalWorkspaces').then((module) => module.StaffOperationalWorkspaces),
  { ssr: false },
);

type Props = {
  locale: AppLocale;
  copy: StaffOperationalWorkspaceCopy;
};

type SessionContext = { active?: boolean };

export function StaffOperationalWorkspacesDeferred({ locale, copy }: Props) {
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/staff/session-context', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({})) as SessionContext;
      setActive(response.ok && payload.active === true);
    } catch {
      setActive(false);
    }
  }, []);

  useEffect(() => {
    const markReady = () => {
      setReady(true);
      void refresh();
    };
    const sessionChanged = () => void refresh();
    if (document.documentElement.dataset.staffControlReady === 'true') markReady();
    window.addEventListener('pc:staff-control-ready', markReady);
    window.addEventListener('pc:staff-session-changed', sessionChanged);
    return () => {
      window.removeEventListener('pc:staff-control-ready', markReady);
      window.removeEventListener('pc:staff-session-changed', sessionChanged);
    };
  }, [refresh]);

  if (!ready || !active) return null;
  return <DeferredWorkspaces locale={locale} copy={copy} />;
}
