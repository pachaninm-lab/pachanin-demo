'use client';

import { useEffect } from 'react';
import { PLATFORM_V7_ACTIVE_ROLE_KEY } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

type Props = {
  role: PlatformRole;
  target: string;
  label: string;
};

export function OwnerCabinetHandoff({ role, target, label }: Props) {
  useEffect(() => {
    window.sessionStorage.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role);
    window.location.replace(target);
  }, [role, target]);

  return (
    <main
      aria-live="polite"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: '#f3f8f5',
        color: '#10231d',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <section
        style={{
          width: 'min(100%, 520px)',
          padding: '28px',
          border: '1px solid rgba(19,75,55,.16)',
          borderRadius: '24px',
          background: '#fff',
          textAlign: 'center',
          boxShadow: '0 18px 48px rgba(15,51,39,.09)',
        }}
      >
        <strong style={{ display: 'block', fontSize: '24px', lineHeight: 1.2 }}>Открываем кабинет</strong>
        <p style={{ margin: '12px 0 0', color: '#5a7067', lineHeight: 1.5 }}>{label}</p>
        <noscript>
          <a href={target}>Продолжить</a>
        </noscript>
      </section>
    </main>
  );
}
