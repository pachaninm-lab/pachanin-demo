'use client';

import dynamic from 'next/dynamic';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export type HydrationSafeChatSupportProps = {
  verifiedRole?: PlatformRole;
  renderDock?: boolean;
  legacyPublicPolish?: boolean;
};

type ContextualSupportProps = Omit<HydrationSafeChatSupportProps, 'legacyPublicPolish'>;

const ContextualSupportOrAssistant = dynamic<ContextualSupportProps>(
  () => import('@/components/platform-v7/ContextualSupportOrAssistant').then((module) => module.ContextualSupportOrAssistant),
  { ssr: false, loading: () => null },
);

const LegacyPublicMobileExperiencePolish = dynamic(
  () => import('@/components/platform-v7/LegacyPublicMobileExperiencePolish').then((module) => module.LegacyPublicMobileExperiencePolish),
  { ssr: false, loading: () => null },
);

/**
 * Public pages keep the contact-support form. Authenticated platform-v7 workspaces
 * receive one role-scoped conversational assistant with presence, structured
 * decision cards and a persistent synthetic/authoritative data-mode label.
 * The surface remains browser-only so time-aware greetings, focus management and
 * route context never destabilize streamed HTML or hydration.
 */
export function HydrationSafeChatSupport({
  legacyPublicPolish = false,
  ...supportProps
}: HydrationSafeChatSupportProps) {
  return (
    <>
      {legacyPublicPolish ? <LegacyPublicMobileExperiencePolish /> : null}
      <ContextualSupportOrAssistant {...supportProps} />
      {legacyPublicPolish ? <style>{terminalPublicSpacingCss}</style> : null}
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
