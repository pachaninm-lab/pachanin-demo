import type { ReactNode } from 'react';

/**
 * Platform V7 presentation is owned by server-selected public, staff or protected
 * runtimes. No route mounts DOM mutation, viewport polling, copy replacement or
 * role-repair patches from the template boundary.
 */
export default function PlatformV7Template({ children }: { children: ReactNode }) {
  return children;
}
