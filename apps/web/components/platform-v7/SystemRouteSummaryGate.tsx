'use client';

import { usePathname } from 'next/navigation';
import { ExternalCopyGuard } from './ExternalCopyGuard';
import { SystemRouteSummary } from './SystemRouteSummary';

type SystemSurface =
  | 'operator'
  | 'operatorQueues'
  | 'controlTower'
  | 'lab'
  | 'compliance'
  | 'demo'
  | 'notifications'
  | 'profile'
  | 'auth'
  | 'register'
  | 'deployCheck';

export function getPlatformV7SystemSurface(pathname: string | null): SystemSurface | undefined {
  if (!pathname) return undefined;
  if (pathname === '/platform-v7/operator') return 'operator';
  if (pathname === '/platform-v7/operator-cockpit/queues') return 'operatorQueues';
  if (pathname === '/platform-v7/control-tower') return 'controlTower';
  if (pathname === '/platform-v7/lab') return 'lab';
  if (pathname === '/platform-v7/compliance') return 'compliance';
  if (pathname === '/platform-v7/demo') return 'demo';
  if (pathname === '/platform-v7/notifications') return 'notifications';
  if (pathname === '/platform-v7/profile') return 'profile';
  if (pathname === '/platform-v7/auth' || pathname === '/platform-v7/login') return 'auth';
  if (pathname === '/platform-v7/register') return 'register';
  if (pathname === '/platform-v7/deploy-check') return 'deployCheck';
  return undefined;
}

function MobileHeaderRuntimeStyle() {
  return (
    <style>{`
      @media (max-width: 560px) {
        .pc-header-top {
          align-items: center !important;
          gap: 8px !important;
          overflow: visible !important;
        }

        .pc-header-brand {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          max-width: calc(100vw - 148px) !important;
          overflow: hidden !important;
        }

        .pc-brand-copy,
        .pc-brand-title,
        .pc-brand-subtitle,
        .pc-brand-crumbs {
          display: none !important;
        }

        .pc-header-actions {
          flex: 0 0 auto !important;
          margin-left: auto !important;
          gap: 6px !important;
          overflow: visible !important;
          padding-right: max(0px, env(safe-area-inset-right)) !important;
        }

        .pc-mobile-role,
        .pc-header-actions select,
        .pc-header-actions .pc-shell-select {
          display: none !important;
        }

        .pc-shell-iconbtn {
          min-width: 44px !important;
          min-height: 44px !important;
          flex: 0 0 44px !important;
          padding: 9px !important;
          overflow: visible !important;
        }

        .pc-shell-iconbtn > span[aria-hidden='true'] {
          top: 2px !important;
          right: 2px !important;
          transform: none !important;
        }
      }

      @media (max-width: 390px) {
        .pc-header-brand {
          max-width: calc(100vw - 136px) !important;
        }

        .pc-header-actions {
          gap: 4px !important;
        }

        .pc-shell-iconbtn {
          min-width: 42px !important;
          min-height: 42px !important;
          flex-basis: 42px !important;
          padding: 8px !important;
        }
      }
    `}</style>
  );
}

export function SystemRouteSummaryGate() {
  const pathname = usePathname();
  const surface = getPlatformV7SystemSurface(pathname);

  return (
    <>
      <MobileHeaderRuntimeStyle />
      <ExternalCopyGuard />
      {surface ? <SystemRouteSummary surface={surface} /> : null}
    </>
  );
}
