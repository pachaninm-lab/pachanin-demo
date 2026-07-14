'use client';

import dynamic from 'next/dynamic';

/**
 * Support is a browser-only interaction surface. A no-SSR dynamic boundary keeps
 * its inline style payload out of streamed HTML and the React hydration tree,
 * while preserving the widget immediately after the client bundle is ready.
 */
export const HydrationSafeChatSupport = dynamic(
  () => import('@/components/platform-v7/ChatSupportWidget').then((module) => module.ChatSupportWidget),
  { ssr: false, loading: () => null },
);
