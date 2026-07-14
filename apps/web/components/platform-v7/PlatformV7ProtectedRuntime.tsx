'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/v7r/Toast';
import { PlatformThemeSync } from '@/components/v7r/PlatformThemeSync';
import { PlatformV7ProtectedShell } from '@/components/platform-v7/PlatformV7ProtectedShell';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import styles from './PlatformV7ProtectedRuntime.module.css';

export function PlatformV7ProtectedRuntime({
  pathname,
  verifiedRole,
  children,
}: {
  pathname: string;
  verifiedRole: PlatformRole;
  children: ReactNode;
}) {
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  // The server layout has already verified the signed session and RBAC. Keep
  // the server and first client tree deterministic, then mount the interactive
  // shell after hydration so persisted presentation state and portals cannot
  // mutate streamed server-component text before React owns the boundary.
  if (!hydrated) {
    return (
      <main className={styles.hydrationSurface} aria-live='polite' data-protected-shell-hydration='pending'>
        <section className={styles.hydrationCard}>
          <strong>Открываем рабочее пространство</strong>
          <span>Проверяем интерфейс кабинета и доступные действия.</span>
        </section>
      </main>
    );
  }

  return (
    <ToastProvider>
      <PlatformThemeSync />
      <PlatformV7ProtectedShell pathname={pathname} verifiedRole={verifiedRole}>{children}</PlatformV7ProtectedShell>
    </ToastProvider>
  );
}
