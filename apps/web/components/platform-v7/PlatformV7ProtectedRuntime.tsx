'use client';

import type { ReactNode } from 'react';
import '@/app/v9.css';
import '@/app/v9-accessibility.css';
import '@/styles/theme.css';
import '@/styles/enterprise-ui.css';
import '@/styles/design-fixes.css';
import '@/styles/mobile-polish.css';
import '@/styles/platform-v7-dark-role-fixes.css';
import '@/styles/platform-v7-shell-clarity.css';
import '@/styles/platform-v7-work-surfaces.css';
import '@/styles/platform-v7-mobile-excellence.css';
import '@/styles/platform-v7-premium-visual-polish.css';
import '@/styles/platform-v7-final-polish.css';
import '@/styles/platform-v7-living-deal.css';
import '@/styles/platform-v7-premium-cockpit.css';
import '@/styles/platform-v7-entry-fix.css';
import '@/styles/platform-v7-mobile-hardening.css';
import '@/styles/platform-v7-mobile-reflow-p0.css';
import '@/styles/platform-v7-shell-restore.css';
import '@/styles/platform-v7-register-header-override.css';
import '@/styles/platform-v7-mobile-screenshot-fixes.css';
import '@/styles/platform-v7-mobile-shell-p1.css';
import '@/styles/platform-v7-shell-critical.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-seller-mobile-usability.css';
import '@/styles/platform-v7-mobile-bottom-tools.css';
import '@/styles/platform-v7-seller-workspace-v2.css';
import { ToastProvider } from '@/components/v7r/Toast';
import { PlatformThemeSync } from '@/components/v7r/PlatformThemeSync';
import { PlatformV7ShellSwitch } from '@/components/platform-v7/PlatformV7ShellSwitch';

export function PlatformV7ProtectedRuntime({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <PlatformThemeSync />
      <PlatformV7ShellSwitch>{children}</PlatformV7ShellSwitch>
    </ToastProvider>
  );
}
