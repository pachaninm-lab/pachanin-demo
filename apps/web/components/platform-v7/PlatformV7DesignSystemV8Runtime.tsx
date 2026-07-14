'use client';

import type { ReactNode } from 'react';
import '../../../../packages/design-tokens/tokens.css';
import { HydrationSafeChatSupport } from '@/components/platform-v7/HydrationSafeChatSupport';

/**
 * Minimal runtime for routes accepted into Design System v8.
 *
 * It deliberately excludes the historical global style bundle, DOM mutation
 * guards, copy replacement, viewport polling and role repair patches. The
 * governed AppShell and route components own their responsive and accessible
 * presentation through tokens and CSS Modules.
 */
export function PlatformV7DesignSystemV8Runtime({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <HydrationSafeChatSupport />
    </>
  );
}
