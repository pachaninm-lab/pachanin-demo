import type { ReactNode } from 'react';
import { PlatformV7InteractionFixes } from '@/components/platform-v7/PlatformV7InteractionFixes';

export default function PlatformV7Template({ children }: { children: ReactNode }) {
  return (
    <>
      <PlatformV7InteractionFixes />
      {children}
    </>
  );
}
