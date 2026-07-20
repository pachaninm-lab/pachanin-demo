'use client';

import dynamic from 'next/dynamic';
import './PublicMobileExperiencePolish.css';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export type HydrationSafeChatSupportProps = {
  verifiedRole?: PlatformRole;
  renderDock?: boolean;
};

/**
 * Public pages keep the contact-support form. Authenticated platform-v7 workspaces
 * receive one role-scoped conversational assistant with presence, structured
 * decision cards and a persistent synthetic/authoritative data-mode label.
 * The surface remains browser-only so time-aware greetings, focus management and
 * route context never destabilize streamed HTML or hydration.
 */
export const HydrationSafeChatSupport = dynamic<HydrationSafeChatSupportProps>(
  () => import('@/components/platform-v7/ContextualSupportOrAssistant').then((module) => module.ContextualSupportOrAssistant),
  { ssr: false, loading: () => null },
);
