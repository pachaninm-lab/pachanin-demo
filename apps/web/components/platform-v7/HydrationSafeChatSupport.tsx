'use client';

import dynamic from 'next/dynamic';

/**
 * Public pages keep the contact-support form. Authenticated platform-v7 workspaces
 * receive the role-scoped AI assistant. The entire surface remains browser-only
 * to keep streamed HTML and hydration deterministic.
 */
export const HydrationSafeChatSupport = dynamic(
  () => import('@/components/platform-v7/ContextualSupportOrAssistant').then((module) => module.ContextualSupportOrAssistant),
  { ssr: false, loading: () => null },
);
