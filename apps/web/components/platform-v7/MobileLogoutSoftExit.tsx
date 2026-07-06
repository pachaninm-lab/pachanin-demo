'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const STORE_KEY = 'pc-session-v10';

function expireCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function MobileLogoutSoftExit() {
  const router = useRouter();

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('.p7-mobile-danger');
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      try {
        window.sessionStorage.removeItem(ACTIVE_ROLE_KEY);
        window.localStorage.removeItem(STORE_KEY);
        expireCookie('pc-role');
        expireCookie('pc_v7_entry_seen');
      } catch {}

      router.replace('/platform-v7?from=logout', { scroll: true });
      window.requestAnimationFrame(() => window.scrollTo(0, 0));
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  return null;
}
