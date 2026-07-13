'use client';

import type { ReactNode } from 'react';
import '../../../../packages/design-tokens/tokens.css';
import { PlatformV7FixedHeaderRuntime } from './PlatformV7FixedHeaderRuntime';

/**
 * Runtime boundary for routes that completed Design System v8 acceptance.
 * Legacy v9 and platform-v7 global style bundles are intentionally forbidden here.
 */
export function PlatformV7DesignSystemV8Runtime({ children }: { children: ReactNode }) {
  return <PlatformV7FixedHeaderRuntime>{children}</PlatformV7FixedHeaderRuntime>;
}
