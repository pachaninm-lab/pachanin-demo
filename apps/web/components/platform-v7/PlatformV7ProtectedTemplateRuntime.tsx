'use client';

import type { ReactNode } from 'react';
import { PlatformV7ProductionCopyPatch } from '@/components/platform-v7/PlatformV7ProductionCopyPatch';
import { PlatformV7ScrollRestorationGuard } from '@/components/platform-v7/PlatformV7ScrollRestorationGuard';
import { PlatformV7TemplateGuards } from '@/components/platform-v7/PlatformV7TemplateGuards';

export function PlatformV7ProtectedTemplateRuntime({ children }: { children: ReactNode }) {
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
