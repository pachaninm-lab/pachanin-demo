'use client';

import { usePathname } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const FIELD_SHELL_ROLES = new Set<PlatformRole>(['driver', 'surveyor', 'elevator', 'lab']);
const FIELD_SHELL_PATHS = ['/platform-v7/driver', '/platform-v7/surveyor', '/platform-v7/elevator', '/platform-v7/lab'] as const;

const ROLE_SCOPED_SHELL_ROLES = new Set<PlatformRole>([
  'buyer',
  'seller',
  'logistics',
  'bank',
  'arbitrator',
  'compliance',
]);

const ROLE_SCOPED_SHELL_PATHS = [
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/procurement',
  '/platform-v7/logistics',
  '/platform-v7/bank',
  '/platform-v7/arbitrator',
  '/platform-v7/compliance',
] as const;

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

      .pc-v4-top > button.pc-v4-iconbtn:first-child {
        display: none !important;
      }

      .pc-v4-main {
        padding-top: calc(env(safe-area-inset-top) + 76px) !important;
      }

      @media (max-width: 640px) {
        .pc-v4-title,
        .pc-v4-subtitle {
          display: none !important;
        }

        .pc-v4-brand {
          max-width: 48px !important;
        }

        .pc-v4-main {
          padding-top: calc(env(safe-area-inset-top) + 68px) !important;
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
      .pc-v4-statuses {
        display: none !important;
      }

      .pc-v4-main {
        padding-top: calc(var(--pc-header-offset) + 8px) !important;
      }

      @media (max-width: 640px) {
        .pc-shell-root-v4 {
          --pc-header-offset: 84px !important;
        }

        .pc-v4-top {
          grid-template-columns: auto minmax(0, 1fr) auto !important;
        }

        .pc-v4-title {
          max-width: 132px !important;
        }

        .pc-v4-main {
          padding-top: calc(var(--pc-header-offset) + 10px) !important;
        }
      }
    `}</style>
  );
}

export function ScopedShellGuard() {
  const pathname = usePathname();
  const role = usePlatformV7RStore((state) => state.role);
  const fieldByPath = FIELD_SHELL_PATHS.some((path) => pathname.startsWith(path));
  const isFieldShell = fieldByPath || FIELD_SHELL_ROLES.has(role);
  if (isFieldShell) return <FieldShellPolicy />;

  const roleScopedByPath = ROLE_SCOPED_SHELL_PATHS.some((path) => pathname.startsWith(path));
  const isRoleScopedShell = roleScopedByPath || ROLE_SCOPED_SHELL_ROLES.has(role);
  if (isRoleScopedShell) return <RoleScopedShellPolicy />;

  return null;
}
