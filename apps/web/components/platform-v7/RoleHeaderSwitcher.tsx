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
    minWidth: 112,
    maxWidth: 158,
    border: '1px solid var(--pc-border)',
    borderRadius: 14,
    background: 'var(--pc-bg-card)',
    color: 'var(--pc-text-primary)',
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    boxShadow: 'var(--pc-shadow-sm)',
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  } as const;
}

function readonlyRoleStyle() {
  return {
    ...roleControlStyle(),
    minWidth: 104,
    opacity: 0.94,
  } as const;
}

function roleValueStyle() {
  return {
    minWidth: 0,
    color: 'var(--pc-text-primary)',
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as const;
}

function roleMenuStyle(position: { top: number; right: number; width: number }) {
  return {
    position: 'fixed',
    top: position.top,
    right: position.right,
    width: position.width,
    maxWidth: 'calc(100vw - 28px)',
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(15,20,25,0.92)',
    color: '#fff',
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(15,23,42,0.34)',
    backdropFilter: 'blur(18px)',
    zIndex: 2147483000,
  } as const;
}

function roleMenuItemStyle(active: boolean) {
  return {
    width: '100%',
    minHeight: 54,
    border: 0,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
    color: '#fff',
    padding: '0 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 18,
    fontWeight: 760,
    letterSpacing: '0.01em',
    textAlign: 'left',
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
  const [open, setOpen] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ top: 74, right: 14, width: 280 });
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (routeRole !== storedRole) setRole(routeRole);
  }, [routeRole, storedRole, setRole]);

  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!target) return null;

  if (shellPolicy === 'field') {
    return createPortal(
      <span aria-label={`Текущая роль: ${ROLE_LABELS[routeRole]}`} data-role-header-label='true' data-testid='platform-v7-header-role-label' style={readonlyRoleStyle()}>
        <strong style={roleValueStyle()}>{ROLE_LABELS[routeRole]}</strong>
      </span>,
      target,
    );
  }

  if (!canShowPortalRoleSwitcher(routeRole, pathname)) return null;

  const switchRole = (nextRole: PlatformRole) => {
    setOpen(false);
    if (nextRole === routeRole) return;
    setRole(nextRole);
    trackRoleSwitch(nextRole);
    router.push(ROLE_ROUTES[nextRole]);
  };

  const button = (
    <button
      ref={buttonRef}
      type='button'
      aria-haspopup='menu'
      aria-expanded={open}
      aria-label={`Текущая роль: ${ROLE_LABELS[routeRole]}. Открыть выбор роли`}
      data-role-header-switcher-wrap='true'
      data-testid='platform-v7-header-role-switcher'
      style={{ ...roleControlStyle(), cursor: 'pointer' }}
      onClick={() => {
        const rect = buttonRef.current?.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const nextWidth = Math.min(292, Math.max(236, viewportWidth - 28));
        const nextRight = rect ? Math.max(14, viewportWidth - rect.right) : 14;
        setMenuPosition({
          top: Math.round((rect?.bottom ?? 62) + 8),
          right: viewportWidth < 520 ? 14 : nextRight,
          width: viewportWidth < 520 ? nextWidth : Math.max(220, rect?.width ?? 220),
        });
        setOpen((value) => !value);
      }}
    >
      <span style={roleValueStyle()}>{ROLE_LABELS[routeRole]}</span>
      <span aria-hidden='true' style={{ color: 'var(--pc-text-secondary)', fontSize: 14, lineHeight: 1 }}>{open ? '⌃' : '⌄'}</span>
    </button>
  );

  const menu = open ? createPortal(
    <div role='menu' aria-label='Выбор роли' data-role-header-menu='true' style={roleMenuStyle(menuPosition)}>
      {selectableRoles.map((item) => (
        <button key={item} type='button' role='menuitemradio' aria-checked={item === routeRole} onClick={() => switchRole(item)} style={roleMenuItemStyle(item === routeRole)}>
          <span>{ROLE_LABELS[item]}</span>
          {item === routeRole ? <span aria-hidden='true'>✓</span> : null}
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <>
      {createPortal(button, target)}
      {menu}
    </>
  );
}
