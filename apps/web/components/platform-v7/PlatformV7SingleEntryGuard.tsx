'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

export function PlatformV7SingleEntryGuard() {
  const pathname = usePathname();

  React.useEffect(() => {
    void pathname;
  }, [pathname]);

  return null;
}
