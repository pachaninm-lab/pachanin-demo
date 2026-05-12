'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { trackRoleSwitch } from '@/lib/analytics/track';

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

const ROLE_ROUTES: Record<PlatformRole, string> = {
  operator: '/platform-v7/control-tower',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver/field',
  surveyor: '/platform-v7/surveyor',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  bank: '/platform-v7/bank',
  arbitrator: '/platform-v7/arbitrator',
  compliance: '/platform-v7/compliance',
  executive: '/platform-v7/executive',
};

function useHeaderActionsTarget() {
  const [target, setTarget] = React.useState<Element | null>(null);

  React.useEffect(() => {
    let frame = 0;
    let observer: MutationObserver | null = null;

    const findTarget = () => {
      const nextTarget = document.querySelector('.pc-v4-actions, .pc-header-actions');
      if (nextTarget) {
        setTarget(nextTarget);
        return true;
      }
      return false;
    };

    if (!findTarget()) {
      observer = new MutationObserver(() => {
        if (findTarget()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      frame = window.requestAnimationFrame(findTarget);
    }

    return () => {
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return target;
}

export function RoleHeaderSwitcher() {
  const router = useRouter();
  const target = useHeaderActionsTarget();
  const role = usePlatformV7RStore((state) => state.role);
  const setRole = usePlatformV7RStore((state) => state.setRole);

  if (!target) return null;

  return createPortal(
    <select
      aria-label='Выбор роли'
      title='Выбор роли'
      value={role}
      onChange={(event) => {
        const nextRole = event.target.value as PlatformRole;
        setRole(nextRole);
        trackRoleSwitch(nextRole);
        router.push(ROLE_ROUTES[nextRole]);
      }}
      data-role-header-switcher='true'
      style={{
        minHeight: 42,
        maxWidth: 124,
        border: '1px solid var(--pc-border)',
        borderRadius: 13,
        background: 'var(--pc-bg-card)',
        color: 'var(--pc-text-primary)',
        padding: '0 10px',
        fontSize: 12,
        fontWeight: 850,
        boxShadow: 'var(--pc-shadow-sm)',
      }}
    >
      {(Object.keys(ROLE_LABELS) as PlatformRole[]).map((item) => (
        <option key={item} value={item}>
          {ROLE_LABELS[item]}
        </option>
      ))}
    </select>,
    target,
  );
}
