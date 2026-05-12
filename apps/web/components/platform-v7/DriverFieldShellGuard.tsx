'use client';

import { usePathname } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const FIELD_SHELL_ROLES = new Set<PlatformRole>(['driver', 'surveyor', 'elevator', 'lab']);
const FIELD_SHELL_PATHS = ['/platform-v7/driver', '/platform-v7/surveyor', '/platform-v7/elevator', '/platform-v7/lab'] as const;

export function DriverFieldShellGuard() {
  const pathname = usePathname();
  const role = usePlatformV7RStore((state) => state.role);
  const fieldByPath = FIELD_SHELL_PATHS.some((path) => pathname.startsWith(path));
  const isFieldShell = fieldByPath || FIELD_SHELL_ROLES.has(role);
  if (!isFieldShell) return null;

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
