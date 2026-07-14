'use client';

import * as React from 'react';
import { ChatSupportWidget } from '@/components/platform-v7/ChatSupportWidget';

/**
 * Support is an interactive browser surface. Rendering it only after the first
 * client commit keeps the server and initial client trees byte-stable while
 * preserving the widget on every public page immediately after hydration.
 */
export function HydrationSafeChatSupport() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? <ChatSupportWidget /> : null;
}
