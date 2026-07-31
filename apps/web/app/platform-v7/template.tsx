import type { ReactNode } from 'react';

/**
 * Platform V7 pages own their rendering contract through the public shell,
 * the server-verified protected shell and Design System v8 route components.
 * Route-level literal styles and historical DOM mutation are intentionally absent.
 */
export default function PlatformV7Template({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
