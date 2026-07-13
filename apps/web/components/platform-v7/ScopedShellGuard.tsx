'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getShellPolicy } from '@/lib/platform-v7/shell-role-policy';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';
import styles from './ScopedShellGuard.module.css';

/**
 * Applies presentation policy metadata to the canonical AppShell.
 * Styling is owned by a scoped CSS module; this component never injects CSS.
 */
export function ScopedShellGuard() {
  const pathname = usePathname();
  const role = usePlatformV7RStore((state) => state.role);
  const shellPolicy = getShellPolicy(role, pathname);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('.pc-shell-root-v4');
    if (!shell) return;

    shell.classList.add(styles.policyRoot);
    shell.dataset.shellPolicy = shellPolicy;
    shell.dataset.shellRole = role;

    return () => {
      shell.classList.remove(styles.policyRoot);
      if (shell.dataset.shellPolicy === shellPolicy) delete shell.dataset.shellPolicy;
      if (shell.dataset.shellRole === role) delete shell.dataset.shellRole;
    };
  }, [role, shellPolicy]);

  return null;
}
