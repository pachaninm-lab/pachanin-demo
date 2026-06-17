import type { ReactNode } from 'react';
import { PlatformV7InteractionFixes } from '@/components/platform-v7/PlatformV7InteractionFixes';
import '@/styles/platform-v7-public-entry-stable.css';
import '@/styles/platform-v7-role-cards-stable.css';

export default function PlatformV7Template({ children }: { children: ReactNode }) {
  return (
    <>
      <PlatformV7InteractionFixes />
      {children}
    </>
  );
}
