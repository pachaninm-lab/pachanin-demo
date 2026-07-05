import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PlatformV7RouteAwareShellBoundary } from '@/components/platform-v7/PlatformV7RouteAwareShellBoundary';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
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
import '@/styles/platform-v7-public-header-hydration-guard.css';

export const metadata: Metadata = { title: 'Platform v7', robots: { index: false, follow: false } };

export default function PlatformV7Layout({ children }: { children: ReactNode }) {
  const initialRole: PlatformRole = 'operator';
  return <PlatformV7RouteAwareShellBoundary initialRole={initialRole}>{children}</PlatformV7RouteAwareShellBoundary>;
}
