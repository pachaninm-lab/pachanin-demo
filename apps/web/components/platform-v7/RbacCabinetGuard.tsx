'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';
import { cabinetAccessDecision } from '@/lib/platform-v7/cabinet-access-policy';

// Cabinet-level RBAC on client.
// Active cabinet role must not be inferred from the URL: one selected role remains
// locked for the current entry session until the user enters again through login.
export function RbacCabinetGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const role = usePlatformV7RStore((state) => state.role);

  React.useEffect(() => {
    if (!pathname) return;
    const decision = cabinetAccessDecision(role, pathname);
    if (!decision.allowed && decision.redirectTo) {
      router.replace(decision.redirectTo);
    }
  }, [pathname, role, router]);

  return null;
}
