import type { ReactNode } from 'react';
import { PlatformV7ProductionCopyPatch } from '@/components/platform-v7/PlatformV7ProductionCopyPatch';
import { PlatformV7ScrollRestorationGuard } from '@/components/platform-v7/PlatformV7ScrollRestorationGuard';
import { PlatformV7TemplateGuards } from '@/components/platform-v7/PlatformV7TemplateGuards';
import '@/styles/platform-v7-protected-grid-stable.css';
import '@/styles/platform-v7-control-tower-mobile.css';
import '@/styles/platform-v7-bank-mobile.css';
import '@/styles/platform-v7-elevator-mobile.css';
import '@/styles/platform-v7-lab-mobile.css';
import '@/styles/platform-v7-compliance-mobile.css';
import '@/styles/platform-v7-arbitrator-mobile.css';
import '@/styles/platform-v7-executive-mobile.css';
import '@/styles/platform-v7-clean-deal-mobile.css';
import '@/styles/platform-v7-offer-to-deal-mobile.css';
import '@/styles/platform-v7-stable-shell.css';

export function PlatformV7ProtectedTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <PlatformV7ProductionCopyPatch />
      <PlatformV7ScrollRestorationGuard />
      <PlatformV7TemplateGuards position='before' />
      {children}
      <PlatformV7TemplateGuards position='after' />
    </>
  );
}
