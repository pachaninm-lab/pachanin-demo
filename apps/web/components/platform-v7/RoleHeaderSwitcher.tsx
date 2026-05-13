'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { trackRoleSwitch } from '@/lib/analytics/track';
import { canShowPortalRoleSwitcher, getHeaderSelectableRoles, getShellPolicy, inferPlatformRoleFromPath } from '@/lib/platform-v7/shell-role-policy';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

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

function roleControlStyle() {
  return {
    minHeight: 42,
    maxWidth: 176,
    border: '1px solid var(--pc-border)',
    borderRadius: 13,
    background: 'var(--pc-bg-card)',
    color: 'var(--pc-text-primary)',
    padding: '6px 10px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: 'var(--pc-shadow-sm)',
  } as const;
}

function roleCaptionStyle() {
  return {
    color: 'var(--pc-text-secondary)',
    fontSize: 10,
    fontWeight: 850,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  } as const;
}

function roleValueStyle() {
  return {
    minWidth: 0,
    color: 'var(--pc-text-primary)',
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.15,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as const;
}

function roleSelectStyle() {
  return {
    minWidth: 104,
    maxWidth: 124,
    border: 0,
    outline: 0,
    background: 'transparent',
    color: 'var(--pc-text-primary)',
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.15,
    cursor: 'pointer',
  } as const;
}

export function RoleHeaderSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const target = useHeaderActionsTarget();
  const storedRole = usePlatformV7RStore((state) => state.role);
  const setRole = usePlatformV7RStore((state) => state.setRole);
  const routeRole = inferPlatformRoleFromPath(pathname, storedRole);
  const selectableRoles = getHeaderSelectableRoles(routeRole, pathname);
  const shellPolicy = getShellPolicy(routeRole, pathname);

  React.useEffect(() => {
    if (routeRole !== storedRole) setRole(routeRole);
  }, [routeRole, storedRole, setRole]);

  if (!target) return null;

  if (shellPolicy === 'field') {
    return createPortal(
      <span aria-label={`Текущая роль: ${ROLE_LABELS[routeRole]}`} data-role-header-label='true' data-testid='platform-v7-header-role-label' style={roleControlStyle()}>
        <span style={roleCaptionStyle()}>Роль</span>
        <strong style={roleValueStyle()}>{ROLE_LABELS[routeRole]}</strong>
      </span>,
      target,
    );
  }

  if (!canShowPortalRoleSwitcher(routeRole, pathname)) return null;

  return createPortal(
    <label aria-label='Выбор роли в шапке' data-role-header-switcher-wrap='true' data-testid='platform-v7-header-role-switcher' style={roleControlStyle()}>
      <span style={roleCaptionStyle()}>Роль</span>
      <select
        aria-label='Выбор роли'
        title='Выбор роли'
        value={routeRole}
        onChange={(event) => {
          const nextRole = event.target.value as PlatformRole;
          setRole(nextRole);
          trackRoleSwitch(nextRole);
          router.push(ROLE_ROUTES[nextRole]);
        }}
        data-role-header-switcher='true'
        style={roleSelectStyle()}
      >
        {selectableRoles.map((item) => (
          <option key={item} value={item}>
            {ROLE_LABELS[item]}
          </option>
        ))}
      </select>
    </label>,
    target,
  );
}
