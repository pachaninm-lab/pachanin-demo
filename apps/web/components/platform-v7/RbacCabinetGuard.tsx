'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';
import { cabinetAccessDecision } from '@/lib/platform-v7/cabinet-access-policy';
import { inferPlatformRoleFromPath } from '@/lib/platform-v7/shell-role-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

// Cabinet-level RBAC на клиенте: при включённом enforcement (флаг/боевой контур)
// уводит роль с чужого кабинета на экран выбора кабинета. В пилоте — no-op
// (открытый доступ сохраняется). Авторитетная защита операций — на сервере
// (action-boundary/runtime через access-control).
export function RbacCabinetGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const role = usePlatformV7RStore((state) => state.role);
  const setRole = usePlatformV7RStore((state) => state.setRole);

  React.useEffect(() => {
    if (!pathname) return;
    const pathRole = inferPlatformRoleFromPath(pathname, role) as PlatformRole;
    if (pathRole !== role) setRole(pathRole);
  }, [pathname, role, setRole]);

  React.useEffect(() => {
    if (!pathname) return;
    const decision = cabinetAccessDecision(role, pathname);
    if (!decision.allowed && decision.redirectTo) {
      router.replace(decision.redirectTo);
    }
  }, [pathname, role, router]);

  return null;
}
