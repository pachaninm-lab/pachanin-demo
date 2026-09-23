'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { reportPublicGektaUnavailable } from '@/lib/platform-v7/public-gekta-open';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import '@/styles/platform-v7-public-cjk-runtime.css';
import '@/styles/platform-v7-home-mobile-brand.css';
import '@/styles/platform-v7-home-hero-card-legibility.css';

export type HydrationSafeChatSupportProps = {
  verifiedRole?: PlatformRole;
  renderDock?: boolean;
  legacyPublicPolish?: boolean;
};

type ContextualSupportProps = Omit<HydrationSafeChatSupportProps, 'legacyPublicPolish'>;

// Locale-native pages do not use the legacy DOM translator. Keep its embedded
// dictionaries out of their initial client graph, not merely out of the JSX.
const PlatformV7TranslationRuntimeBridge = dynamic(
  () => import('@/components/platform-v7/PlatformV7TranslationRuntimeBridge').then((module) => module.PlatformV7TranslationRuntimeBridge),
  { ssr: false, loading: () => null },
);

function AssistantUnavailable(): null {
  return null;
}

// A chunk that fails to load must not replace the whole public page with the
// global error screen. The entry points show an explicit recovery instead.
const ContextualSupportOrAssistant = dynamic<ContextualSupportProps>(
  () => import('@/components/platform-v7/ContextualSupportOrAssistant')
    .then((module) => module.ContextualSupportOrAssistant)
    .catch(() => {
      reportPublicGektaUnavailable();
      return AssistantUnavailable;
    }),
  { ssr: false, loading: () => null },
);

const LegacyPublicMobileExperiencePolish = dynamic(
  () => import('@/components/platform-v7/LegacyPublicMobileExperiencePolish').then((module) => module.LegacyPublicMobileExperiencePolish),
  { ssr: false, loading: () => null },
);

function normalizePath(pathname: string): string {
  return pathname.split('?')[0].replace(/\/+$/u, '') || '/platform-v7';
}

function isStrategicHomepage(pathname: string): boolean {
  const clean = normalizePath(pathname);
  return clean === '/platform-v7' || clean === '/pc-public-entry/platform-v7';
}

function needsLegacyTranslationBridge(pathname: string): boolean {
  const clean = normalizePath(pathname);
  // The homepage and contact route now own complete RU/EN/ZH source copy.
  // Keep the legacy DOM translator only where older public surfaces still rely
  // on dictionary-based post-hydration translation.
  return clean === '/platform-v7/deal-flow' || clean === '/platform-v7/demo';
}

/**
 * Public pages keep the contact-support form. Authenticated platform-v7 workspaces
 * receive one role-scoped conversational assistant with presence, structured
 * decision cards and a persistent synthetic/authoritative data-mode label.
 * The surface remains browser-only so time-aware greetings, focus management and
 * route context never destabilize streamed HTML or hydration.
 */
export function HydrationSafeChatSupport({
  legacyPublicPolish,
  ...supportProps
}: HydrationSafeChatSupportProps) {
  const pathname = usePathname() || '/platform-v7';
  const loadLegacyPublicPolish = legacyPublicPolish ?? !isStrategicHomepage(pathname);
  const loadTranslationBridge = needsLegacyTranslationBridge(pathname);

  return (
    <>
      {loadTranslationBridge ? <PlatformV7TranslationRuntimeBridge /> : null}
      {loadLegacyPublicPolish ? <LegacyPublicMobileExperiencePolish /> : null}
      <ContextualSupportOrAssistant {...supportProps} />
      {loadLegacyPublicPolish ? <style>{terminalPublicSpacingCss}</style> : null}
    </>
  );
}

const terminalPublicSpacingCss = `
html body .pc-ppe-page .pc-ppe-section {
  padding-block: 48px;
}
html body .pc-ppe-page .pc-ppe-section-header {
  margin-bottom: 20px;
}
html body .pc-ppe-page .pc-ppe-hero {
  padding-top: 36px;
  padding-bottom: 36px;
}
html body .pc-ppe-page .pc-ppe-explorer-intro {
  padding-block: 32px;
}
html body .pc-ppe-page .pc-ppe-final-cta {
  padding-top: 48px;
  padding-bottom: 72px;
}
html body .pc-ppe-page :where(.pc-ppe-section, .pc-ppe-final-cta) + :where(.pc-ppe-section, .pc-ppe-final-cta) {
  margin-top: 0;
}

@media (max-width: 720px) {
  html body .pc-ppe-page .pc-ppe-hero {
    padding-top: 20px;
    padding-bottom: 24px;
  }
  html body .pc-ppe-page .pc-ppe-section {
    padding-block: 28px;
  }
  html body .pc-ppe-page .pc-ppe-section-header {
    margin-bottom: 16px;
  }
  html body .pc-ppe-page .pc-ppe-explorer-intro {
    padding-block: 20px;
  }
  html body .pc-ppe-page .pc-ppe-final-cta {
    padding-top: 32px;
    padding-bottom: 72px;
  }
  html body .pc-ppe-page .pc-ppe-shell {
    padding-bottom: 88px;
  }
}
`;
