'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
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

export function StaffOperationalWorkspacesDeferred({ locale, copy }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const markReady = () => setReady(true);
    if (document.documentElement.dataset.staffControlReady === 'true') markReady();
    window.addEventListener('pc:staff-control-ready', markReady);
    return () => window.removeEventListener('pc:staff-control-ready', markReady);
  }, []);

  if (!ready) return null;
  return <DeferredWorkspaces locale={locale} copy={copy} />;
}
