'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const ROUTES: Record<string, string[]> = {
  '/platform-v4': ['/platform-v4/deal', '/platform-v4/buyer', '/platform-v4/bank', '/platform-v4/control'],
  '/platform-v4/seller': ['/platform-v4/seller/new-lot', '/platform-v4/deal', '/platform-v4/bank', '/platform-v4/documents'],
  '/platform-v4/buyer': ['/platform-v4/funding', '/platform-v4/bank', '/platform-v4/documents', '/platform-v4/deal'],
  '/platform-v4/bank': ['/platform-v4/bank', '/platform-v4/bank', '/platform-v4/control', '/platform-v4/deal'],
};

export function PlatformV4Enhancer() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const root = document.querySelector('[data-platform-v4-refresh="true"]') as HTMLElement | null;
    if (!root) return;

    const links = ROUTES[pathname || ''] || [];
    const cards = Array.from(root.querySelectorAll('[class*="metricCard"]')) as HTMLElement[];
    const cleanups: Array<() => void> = [];

    cards.forEach((card, index) => {
      const href = links[index];
      if (!href) return;

      card.style.cursor = 'pointer';
      card.setAttribute('role', 'link');
      card.setAttribute('tabindex', '0');
      card.setAttribute('title', 'Открыть связанную очередь');

      const onClick = () => router.push(href);
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          router.push(href);
        }
      };

      card.addEventListener('click', onClick);
      card.addEventListener('keydown', onKeyDown);
      cleanups.push(() => {
        card.removeEventListener('click', onClick);
        card.removeEventListener('keydown', onKeyDown);
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [pathname, router]);

  return null;
}
