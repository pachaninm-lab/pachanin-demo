'use client';

import { usePathname } from 'next/navigation';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';

const FIELD_PATHS = ['/platform-v7/driver', '/platform-v7/surveyor', '/platform-v7/elevator', '/platform-v7/lab'];
const FIELD_ROLES = ['driver', 'surveyor', 'elevator', 'lab'];

export function DriverFieldShellGuard() {
  const pathname = usePathname();
  const role = usePlatformV7RStore((s) => s.role);

  const isFieldPath = FIELD_PATHS.some((p) => pathname?.startsWith(p));
  const isFieldRole = FIELD_ROLES.includes(role);

  if (!isFieldPath && !isFieldRole) return null;

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .pc-v4-search { display: none !important; }
      .pc-v4-select { display: none !important; }
      .pc-v4-mobile-role { display: none !important; }
      .pc-v4-meta { display: none !important; }
      .pc-v4-drawer { display: none !important; }
    ` }} />
  );
}
