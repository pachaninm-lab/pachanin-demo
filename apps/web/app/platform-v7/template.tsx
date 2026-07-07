import type { ReactNode } from 'react';
import { PlatformV7TemplateGuards } from '@/components/platform-v7/PlatformV7TemplateGuards';
import '@/styles/platform-v7-public-entry-stable.css';
import '@/styles/platform-v7-role-cards-stable.css';
import '@/styles/platform-v7-protected-grid-stable.css';
import '@/styles/platform-v7-stable-shell.css';
import '@/styles/platform-v7-viewport-stability.css';
import '@/styles/platform-v7-adaptive-devices.css';
import '@/styles/platform-v7-i18n-cjk.css';

export default function PlatformV7Template({ children }: { children: ReactNode }) {
  return (
    <>
      <PlatformV7TemplateGuards position="before" />
      {children}
      <PlatformV7TemplateGuards position="after" />
    </>
  );
}
