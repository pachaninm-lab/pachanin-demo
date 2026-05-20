'use client';

import { usePathname } from 'next/navigation';
import { getShellPolicy } from '@/lib/platform-v7/shell-role-policy';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';

const clarityCss = `
  .pc-v4-pilot-note,
  .pc-v4-statuses,
  .pc-v4-stage,
  .pc-v4-mobile-role,
  .pc-v4-select,
  [data-role-header-switcher-wrap='true'],
  [data-role-header-label='true'] {
    display: none !important;
  }

  .pc-v4-meta {
    display: none !important;
  }

  .pc-v4-subtitle {
    display: none !important;
  }

  nav[data-testid='platform-v7-work-route-nav'] {
    margin: 0 0 8px !important;
    padding: 4px !important;
    border-radius: 16px !important;
    box-shadow: none !important;
  }

  nav[data-testid='platform-v7-work-route-nav'] > div:first-child {
    display: none !important;
  }

  nav[data-testid='platform-v7-work-route-nav'] a {
    min-height: 34px !important;
    padding: 0 10px !important;
  }

  @media (max-width: 640px) {
    .pc-shell-root-v4 {
      --pc-header-offset: 52px !important;
    }

    .pc-v4-header-inner {
      height: 52px !important;
      padding: calc(env(safe-area-inset-top) + 6px) 10px 6px !important;
    }

    .pc-v4-title,
    .pc-v4-subtitle {
      display: none !important;
    }

    .pc-v4-search {
      min-width: 42px !important;
      max-width: 42px !important;
      flex: 0 0 42px !important;
    }

    .pc-v4-main {
      padding-left: 10px !important;
      padding-right: 10px !important;
    }

    nav[data-testid='platform-v7-work-route-nav'] a {
      min-height: 32px !important;
      padding: 0 9px !important;
    }
  }
`;

function FieldShellPolicy() {
  return (
    <style>{`
      ${clarityCss}

      .pc-v4-search,
      .pc-v4-select,
      .pc-v4-mobile-role,
      .pc-v4-stage,
      .pc-v4-meta,
      .pc-v4-drawer,
      nav[data-testid='platform-v7-work-route-nav'] {
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

      .pc-v4-iconbtn {
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
          --pc-header-offset: 64px !important;
        }

        .pc-v4-top {
          grid-template-columns: auto minmax(0, 1fr) auto !important;
          gap: 8px !important;
        }

        .pc-v4-brand {
          max-width: 48px !important;
        }

        .pc-v4-actions {
          min-width: 0 !important;
          gap: 6px !important;
        }

        .pc-v4-iconbtn {
          min-width: 40px !important;
          min-height: 40px !important;
        }

        .pc-v4-main {
          padding-top: calc(env(safe-area-inset-top) + 62px) !important;
        }
      }
    `}</style>
  );
}

function RoleScopedShellPolicy() {
  return (
    <style>{`
      ${clarityCss}

      .pc-v4-search,
      .pc-v4-role-grid,
      .pc-v4-drawer,
      nav[data-testid='platform-v7-work-route-nav'] {
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
          --pc-header-offset: 64px !important;
        }

        .pc-v4-top {
          grid-template-columns: auto minmax(0, 1fr) !important;
          gap: 8px !important;
        }

        .pc-v4-brand {
          max-width: 48px !important;
        }

        .pc-v4-actions {
          min-width: 0 !important;
        }

        .pc-v4-main {
          padding-top: calc(var(--pc-header-offset) + 8px) !important;
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
      ${clarityCss}
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
