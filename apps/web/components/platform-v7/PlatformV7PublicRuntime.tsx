'use client';

import type { ReactNode } from 'react';
import '../../../../packages/design-tokens/tokens.css';
import { ChatSupportWidget } from '@/components/platform-v7/ChatSupportWidget';

/**
 * Minimal runtime for public supporting pages.
 *
 * It intentionally excludes the historical platform stylesheet bundle and every
 * DOM, viewport, copy-replacement and role-repair patch. Public pages own their
 * presentation through tokens and CSS Modules.
 */
export function PlatformV7PublicRuntime({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ChatSupportWidget />
    </>
  );
}
