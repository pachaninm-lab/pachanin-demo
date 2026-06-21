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

  const restoreLockedRole = React.useCallback(() => {
    const locked = lockedRoleFromSession();
    if (!locked || role === locked) return;
    setRole(locked);
    document.cookie = `pc-role=${locked}; Path=/; SameSite=Lax`;
  }, [role, setRole]);

  React.useLayoutEffect(() => {
    restoreLockedRole();
  }, [pathname, restoreLockedRole]);

  // Lock enforcement is event- and state-driven — no polling. `restoreLockedRole`
  // closes over `role`, so any store mutation recreates the callback and re-runs
  // this effect, reverting an out-of-lock role immediately (the same reactive
  // path PlatformV7SingleEntryGuard relies on). The rAF + setTimeout(0) cover the
  // post-hydration race before the store is populated, and popstate/hashchange/
  // focus cover history and tab-visibility changes. This replaces a 50ms polling
  // timer, which only re-ran the identical no-op restore on a busy schedule.
  React.useEffect(() => {
    restoreLockedRole();
    const frame = window.requestAnimationFrame(restoreLockedRole);
    const shortTimer = window.setTimeout(restoreLockedRole, 0);
    window.addEventListener('popstate', restoreLockedRole);
    window.addEventListener('hashchange', restoreLockedRole);
    window.addEventListener('focus', restoreLockedRole);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(shortTimer);
      window.removeEventListener('popstate', restoreLockedRole);
      window.removeEventListener('hashchange', restoreLockedRole);
      window.removeEventListener('focus', restoreLockedRole);
    };
  }, [pathname, restoreLockedRole]);

  return null;
}
