'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleHelp } from 'lucide-react';

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

export function SupportHeaderIcon() {
  const pathname = usePathname();
  const target = useHeaderActionsTarget();
  const active = pathname.startsWith('/platform-v7/support');

  if (!target) return null;

  return createPortal(
    <Link
      href='/platform-v7/support'
      aria-label='Поддержка'
      title='Поддержка'
      className='pc-v4-iconbtn pc-shell-iconbtn'
      data-support-header-icon='true'
      data-active={active}
      style={{
        textDecoration: 'none',
        color: active ? 'var(--pc-accent)' : 'var(--pc-text-secondary)',
        borderColor: active ? 'var(--pc-accent-border)' : undefined,
        background: active ? 'var(--pc-accent-bg)' : undefined,
      }}
    >
      <CircleHelp size={18} strokeWidth={2.2} aria-hidden='true' />
    </Link>,
    target,
  );
}
