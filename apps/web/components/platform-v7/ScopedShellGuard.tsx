'use client';

import { usePathname } from 'next/navigation';
import { getShellPolicy } from '@/lib/platform-v7/shell-role-policy';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';

function FieldShellPolicy() {
  return (
    <style>{`
      .pc-v4-search,
      .pc-v4-select,
      .pc-v4-mobile-role,
      .pc-v4-stage,
      .pc-v4-meta,
      .pc-v4-drawer {
        display: none !important;
      }

      .pc-v4-header {
        background: color-mix(in srgb, var(--pc-bg-header) 98%, transparent) !important;
      }

      .pc-v4-top {
        grid-template-columns: auto minmax(0, 1fr) auto !important;
      }

      .pc-v4-top > button.pc-v4-iconbtn:first-child {
        display: none !important;
      }

      .pc-v4-iconbtn,
      [data-role-header-label='true'] {
        color: var(--pc-text-primary) !important;
        border-color: color-mix(in srgb, var(--pc-border) 88%, var(--pc-text-primary) 12%) !important;
        background: var(--pc-bg-card) !important;
      }

      .pc-v4-iconbtn svg {
        color: var(--pc-text-primary) !important;
        stroke: currentColor !important;
      }

      .pc-v4-main {
        padding-top: calc(env(safe-area-inset-top) + 76px) !important;
      }

      @media (max-width: 640px) {
        .pc-shell-root-v4 {
          --pc-header-offset: 72px !important;
        }

        .pc-v4-top {
          grid-template-columns: auto minmax(0, 1fr) auto !important;
          gap: 8px !important;
        }

        .pc-v4-title,
        .pc-v4-subtitle {
          display: none !important;
        }

        .pc-v4-brand {
          max-width: 48px !important;
        }

        .pc-v4-actions {
          min-width: 0 !important;
          gap: 6px !important;
        }

        [data-role-header-label='true'] {
          max-width: 104px !important;
          min-height: 40px !important;
        }

        .pc-v4-iconbtn {
          min-width: 40px !important;
          min-height: 40px !important;
        }

        .pc-v4-main {
          padding-top: calc(env(safe-area-inset-top) + 66px) !important;
        }
      }
    `}</style>
  );
}

function RoleScopedShellPolicy() {
  return (
    <style>{`
      .pc-v4-select,
      .pc-v4-mobile-role,
      .pc-v4-search,
      .pc-v4-role-grid,
      .pc-v4-statuses,
      .pc-v4-drawer,
      .pc-v4-pilot-note {
        display: none !important;
      }

      .pc-v4-top > button.pc-v4-iconbtn:first-child {
        display: none !important;
      }

      .pc-v4-main {
        padding-top: calc(var(--pc-header-offset) + 8px) !important;
      }

      @media (max-width: 640px) {
        .pc-shell-root-v4 {
          --pc-header-offset: 76px !important;
        }

        .pc-v4-top {
          grid-template-columns: auto minmax(0, 1fr) !important;
          gap: 8px !important;
        }

        .pc-v4-title,
        .pc-v4-subtitle {
          display: none !important;
        }

        .pc-v4-brand {
          max-width: 48px !important;
        }

        .pc-v4-actions {
          min-width: 0 !important;
        }

        .pc-v4-main {
          padding-top: calc(var(--pc-header-offset) + 10px) !important;
        }

        .pc-v4-main h1 {
          font-size: clamp(27px, 7vw, 42px) !important;
          line-height: 1.08 !important;
          letter-spacing: -0.035em !important;
        }
      }
    `}</style>
  );
}

function OperatorShellPolicy() {
  return (
    <style>{`
      @media (max-width: 980px) {
        .pc-v4-mobile-role {
          display: none !important;
        }

        .pc-v4-select {
          display: inline-block !important;
          min-width: 136px !important;
          max-width: 152px !important;
        }
      }

      @media (max-width: 640px) {
        .pc-v4-select {
          min-width: 112px !important;
          max-width: 128px !important;
          padding-inline: 10px !important;
        }
      }
    `}</style>
  );
}

export function ScopedShellGuard() {
  const pathname = usePathname();
  const role = usePlatformV7RStore((state) => state.role);
  const shellPolicy = getShellPolicy(role, pathname);
  if (shellPolicy === 'field') return <FieldShellPolicy />;
  if (shellPolicy === 'role-scoped') return <RoleScopedShellPolicy />;
  return <OperatorShellPolicy />;
}
