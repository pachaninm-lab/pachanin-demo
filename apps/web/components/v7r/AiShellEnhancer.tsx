'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { PlatformV7NotificationCenter } from '@/components/v7r/PlatformV7NotificationCenter';

function HeaderNotificationsPortal() {
  const [target, setTarget] = React.useState<Element | null>(null);

  React.useEffect(() => {
    function syncTarget() {
      setTarget(document.querySelector('.pc-header-actions'));
    }

    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  if (!target) return null;

  return createPortal(
    <span className='pc-header-notifications-slot' aria-label='Значки уведомлений и предупреждений в шапке'>
      <PlatformV7NotificationCenter />
    </span>,
    target,
  );
}

export function AiShellEnhancer() {
  return (
    <>
      <style>{`
        .pc-header-brand > span:first-child,
        .app-header-brand > span:first-child,
        .pc-brand-mark-fallback {
          background-image: none !important;
        }

        .pc-header-brand > span:first-child img,
        .app-header-brand > span:first-child img,
        .pc-brand-mark-fallback img,
        img[src='/apple-icon'],
        img[src^='/apple-icon?'] {
          opacity: 1 !important;
          visibility: visible !important;
          display: block !important;
        }

        .pc-role-banner,
        .pc-giga,
        [data-pc-ai-panel='legacy'],
        #pc-ai-dock,
        .sticky-action,
        .pc-main .pc-giga,
        .pc-main [class*='giga'],
        .pc-main [class*='sticky-action'] {
          display: none !important;
        }

        .pc-header-notifications-slot {
          display: inline-flex;
          align-items: center;
          flex: 0 0 auto;
          order: -1;
        }

        .pc-shell-root {
          --pc-header-offset: 136px !important;
        }

        .pc-main {
          padding-top: calc(var(--pc-header-offset) + 8px) !important;
        }

        @media (max-width: 768px) {
          .pc-shell-root {
            --pc-header-offset: 136px !important;
          }
        }

        @media (max-width: 560px) {
          .pc-shell-root {
            --pc-header-offset: 132px !important;
          }

          .pc-header-notifications-slot {
            order: -1;
          }
        }
      `}</style>
      <HeaderNotificationsPortal />
    </>
  );
}
