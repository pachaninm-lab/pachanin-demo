import type { ReactNode } from 'react';

/**
 * Platform V7 no longer mounts route-specific DOM mutation, viewport polling,
 * copy repair or legacy style runtimes. Public, staff and protected shells own
 * their complete presentation contract in layouts and governed components.
 */
export default function PlatformV7Template({ children }: { children: ReactNode }) {
  return children;
}
