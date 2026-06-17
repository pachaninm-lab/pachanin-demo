'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const VALID_ROLES = new Set<PlatformRole>([
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
]);

function lockedRoleFromSession(): PlatformRole | null {
  if (typeof window === 'undefined') return null;
  const stored = window.sessionStorage.getItem(ACTIVE_ROLE_KEY) as PlatformRole | null;
  return stored && VALID_ROLES.has(stored) ? stored : null;
}

export function PlatformV7RoleLockFix() {
  const pathname = usePathname();
  const role = usePlatformV7RStore((state) => state.role);
  const setRole = usePlatformV7RStore((state) => state.setRole);

  React.useEffect(() => {
    const restoreLockedRole = () => {
      const locked = lockedRoleFromSession();
      if (!locked || role === locked) return;
      setRole(locked);
      document.cookie = `pc-role=${locked}; Path=/; SameSite=Lax`;
    };

    restoreLockedRole();
    const frame = window.requestAnimationFrame(restoreLockedRole);
    const shortTimer = window.setTimeout(restoreLockedRole, 0);
    const timer = window.setInterval(restoreLockedRole, 50);
    window.addEventListener('popstate', restoreLockedRole);
    window.addEventListener('hashchange', restoreLockedRole);
    window.addEventListener('focus', restoreLockedRole);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(shortTimer);
      window.clearInterval(timer);
      window.removeEventListener('popstate', restoreLockedRole);
      window.removeEventListener('hashchange', restoreLockedRole);
      window.removeEventListener('focus', restoreLockedRole);
    };
  }, [pathname, role, setRole]);

  return null;
}
